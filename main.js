import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import { getDatabase } from './src/main/database.js';
import { setupServerIPCHandlers, cleanupAllServers } from './src/main/serverManager.js';
import { getTerminalManager, cleanupTerminalManager } from './src/main/terminalManager.js';
import { getCodexManager } from './src/main/codexManager.js';
import { getThumbnailService } from './src/main/thumbnailService.js';
import { duplicateProjectFiles } from './src/main/projectScaffold.js';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import services from the appropriate location based on environment
const servicesPath = process.env.NODE_ENV === 'development' ? './src/services' : './dist/services';

// Dynamically import services
const { deployToNetlify, getDeploymentRecommendations } = await import(`${servicesPath}/apiNetlifyDeployment.js`);
const { getDeploymentManager } = await import(`${servicesPath}/deploymentSessionManager.js`);
const { getProjectDeploymentState } = await import(`${servicesPath}/projectChangeDetection.js`);

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let codexManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.js'),
    }
  });

  // Load the app
  if (isDev) {
    console.log('Loading dev server at http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    
    // Enable hot reload for React components
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('Failed to load dev server, retrying in 1 second...');
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:5173');
      }, 1000);
    });
  } else {
    // When in production, ensure we use the correct path to the index.html
    // This ensures proper loading of assets relative to the app.asar file
    const indexPath = join(__dirname, 'dist', 'index.html');
    console.log('Loading production file from:', indexPath);
    mainWindow.loadFile(indexPath);
    
    // Log any load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load app:', errorCode, errorDescription);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  setupIPCHandlers();
  setupServerIPCHandlers(mainWindow);
});

app.on('window-all-closed', async () => {
  // Clean up all running servers and terminals before quitting
  await cleanupAllServers();
  cleanupTerminalManager();
  
  // Clean up codex manager
  if (codexManager && codexManager.cleanup) {
    await codexManager.cleanup();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async (event) => {
  // Prevent default quit to allow cleanup
  event.preventDefault();
  
  // Clean up all running servers and terminals
  await cleanupAllServers();
  cleanupTerminalManager();
  
  // Clean up codex manager
  if (codexManager && codexManager.cleanup) {
    await codexManager.cleanup();
  }
  
  // Now actually quit
  app.exit(0);
});

// Setup IPC handlers for database operations
function setupIPCHandlers() {
  const db = getDatabase();

  // Get all projects
  ipcMain.handle('db:getAllProjects', async () => {
    try {
      return db.getAllProjects();
    } catch (error) {
      console.error('Error getting all projects:', error);
      throw error;
    }
  });

  // Add project
  ipcMain.handle('db:addProject', async (event, projectData) => {
    try {
      return db.addProject(projectData);
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  });

  // Update project
  ipcMain.handle('db:updateProject', async (event, id, updates) => {
    try {
      return db.updateProject(id, updates);
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  });

  // Delete project
  ipcMain.handle('db:deleteProject', async (event, id) => {
    try {
      return db.deleteProject(id);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  });

  // Get single project
  ipcMain.handle('db:getProject', async (event, id) => {
    try {
      return db.getProject(id);
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  });

  // Thumbnail management IPC handlers
  const thumbnailService = getThumbnailService();

  // Capture thumbnail from server URL
  ipcMain.handle('thumbnail:capture', async (event, { projectId, serverUrl, options = {} }) => {
    try {
      const thumbnail = await thumbnailService.captureFromUrl(projectId, serverUrl, options);
      
      // Update database with new thumbnail
      db.updateProjectThumbnail(projectId, thumbnail);
      
      // Notify renderer that project data has changed
      if (mainWindow && !mainWindow.isDestroyed()) {
        // console.log('📤 Sending thumbnail update event for project:', projectId);
        mainWindow.webContents.send('project:thumbnail-updated', { projectId, thumbnail });
      }
      
      return { success: true, thumbnail };
    } catch (error) {
      console.error('Error capturing thumbnail:', error);
      return { success: false, error: error.message };
    }
  });

  // Capture thumbnail with debouncing
  ipcMain.handle('thumbnail:debouncedCapture', async (event, { projectId, serverUrl, debounceMs = 5000, options = {} }) => {
    try {
      const thumbnail = await thumbnailService.debouncedCapture(projectId, serverUrl, debounceMs, options);
      
      // Update database with new thumbnail
      db.updateProjectThumbnail(projectId, thumbnail);
      
      // Notify renderer that project data has changed
      if (mainWindow && !mainWindow.isDestroyed()) {
        // console.log('📤 Sending thumbnail update event for project:', projectId);
        mainWindow.webContents.send('project:thumbnail-updated', { projectId, thumbnail });
      }
      
      return { success: true, thumbnail };
    } catch (error) {
      console.error('Error capturing debounced thumbnail:', error);
      return { success: false, error: error.message };
    }
  });

  // Check if server is accessible for thumbnail capture
  ipcMain.handle('thumbnail:checkServer', async (event, { serverUrl }) => {
    try {
      const accessible = await thumbnailService.isServerAccessible(serverUrl);
      return { accessible };
    } catch (error) {
      console.error('Error checking server accessibility:', error);
      return { accessible: false };
    }
  });

  // Generate fallback thumbnail
  ipcMain.handle('thumbnail:generateFallback', async (event, { projectId, projectName, options = {} }) => {
    try {
      const thumbnail = await thumbnailService.generateFallbackThumbnail(projectName, options);
      
      // Update database with fallback thumbnail
      db.updateProjectThumbnail(projectId, thumbnail);
      
      // Notify renderer that project data has changed
      if (mainWindow && !mainWindow.isDestroyed()) {
        // console.log('📤 Sending thumbnail update event for project:', projectId);
        mainWindow.webContents.send('project:thumbnail-updated', { projectId, thumbnail });
      }
      
      return { success: true, thumbnail };
    } catch (error) {
      console.error('Error generating fallback thumbnail:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear all thumbnails (for regeneration with new settings)
  ipcMain.handle('thumbnail:clearAll', async (event) => {
    try {
      const clearedCount = db.clearAllThumbnails();
      
      // Notify renderer that projects need refreshing
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('📤 Sending thumbnails cleared event');
        mainWindow.webContents.send('project:thumbnails-cleared', { clearedCount });
      }
      
      return { success: true, clearedCount };
    } catch (error) {
      console.error('Error clearing thumbnails:', error);
      return { success: false, error: error.message };
    }
  });

  // Rename project IPC handler
  ipcMain.handle('project:rename', async (event, { projectId, newName }) => {
    try {
      console.log('Renaming project:', projectId, '→', newName);
      
      const result = await db.renameProject(projectId, newName);
      
      if (result.success) {
        console.log('Project renamed successfully:', result.newName);
        
        // Notify renderer of successful rename
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('project:renamed', {
            projectId,
            oldName: result.oldName,
            newName: result.newName,
            oldPath: result.oldPath,
            newPath: result.newPath
          });
        }
        
        return {
          success: true,
          ...result
        };
      } else {
        throw new Error('Rename operation failed');
      }
      
    } catch (error) {
      console.error('Project rename failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Duplicate project IPC handler
  ipcMain.handle('project:duplicate', async (event, { projectId, customName = null }) => {
    try {
      console.log('Starting project duplication for:', projectId);
      
      // Step 1: Duplicate in database
      const dbResult = db.duplicateProject(projectId, customName);
      if (!dbResult.success) {
        throw new Error('Failed to create duplicate project in database');
      }

      const { sourceProject, duplicateProject } = dbResult;
      
      // Notify progress
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:duplicate-progress', {
          projectId: duplicateProject.id,
          status: 'info',
          message: 'Created database entry...',
          progress: 10
        });
      }

      // Step 2: Copy files
      const copyResult = await duplicateProjectFiles(
        sourceProject.path,
        duplicateProject.path,
        (progress) => {
          // Forward progress to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('project:duplicate-progress', {
              projectId: duplicateProject.id,
              ...progress
            });
          }
        }
      );

      if (!copyResult.success) {
        // Rollback database changes
        try {
          await db.deleteProject(duplicateProject.id);
        } catch (rollbackError) {
          console.error('Failed to rollback database changes:', rollbackError);
        }
        throw new Error(copyResult.error);
      }

      // Step 3: Generate fallback thumbnail
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:duplicate-progress', {
          projectId: duplicateProject.id,
          status: 'info',
          message: 'Generating thumbnail...',
          progress: 96
        });
      }

      try {
        const thumbnailService = getThumbnailService();
        const thumbnailResult = await thumbnailService.generateFallbackThumbnail(duplicateProject.name);
        if (thumbnailResult) {
          db.updateProjectThumbnail(duplicateProject.id, thumbnailResult);
        }
      } catch (thumbnailError) {
        console.warn('Failed to generate thumbnail for duplicate project:', thumbnailError);
        // Non-critical error, continue
      }

      // Step 4: Complete
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:duplicate-progress', {
          projectId: duplicateProject.id,
          status: 'success',
          message: 'Project duplicated successfully!',
          progress: 100
        });

        // Refresh projects list
        mainWindow.webContents.send('project:duplicate-complete', {
          sourceProject,
          duplicateProject
        });
      }

      return {
        success: true,
        sourceProject,
        duplicateProject
      };

    } catch (error) {
      console.error('Project duplication failed:', error);
      
      // Notify error
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:duplicate-progress', {
          projectId: projectId,
          status: 'error',
          message: error.message,
          progress: 0
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  });

  // Terminal management IPC handlers
  const terminalManager = getTerminalManager();
  
  // Codex MCP management
  codexManager = getCodexManager();
  codexManager.initialize(mainWindow);

  // Codex image handling for attachments
  ipcMain.handle('codex:saveImage', async (event, { projectPath, imageData, filename, isUrl }) => {
    try {
      // Validate sender for security
      if (!event.senderFrame.url.includes('localhost') && !event.senderFrame.url.startsWith('file://')) {
        throw new Error('Unauthorized image save request');
      }

      // Create temp/images directory if it doesn't exist
      const tempDir = path.join(projectPath, 'temp', 'images');
      await fs.mkdir(tempDir, { recursive: true });

      let filePath;
      let thumbnail;

      if (isUrl) {
        // Download image from URL
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(imageData);
        
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const buffer = await response.buffer();
        const ext = path.extname(filename) || '.png';
        const timestamp = Date.now();
        const fileName = `image_${timestamp}${ext}`;
        filePath = path.join(tempDir, fileName);
        
        await fs.writeFile(filePath, buffer);
        
        // Create thumbnail (full base64 for preview)
        thumbnail = `data:image/${ext.slice(1)};base64,${buffer.toString('base64')}`;
      } else {
        // Save base64 image data
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          throw new Error('Invalid image data format');
        }

        const ext = matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');
        
        // Validate file size (max 10MB)
        if (buffer.length > 10 * 1024 * 1024) {
          throw new Error('Image size exceeds 10MB limit');
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        // If filename is provided and doesn't exist, use it; otherwise generate unique name
        const baseFileName = filename || `image_${timestamp}_${randomSuffix}.${ext}`;
        
        // Ensure we don't overwrite existing files
        let fileName = baseFileName;
        let counter = 1;
        filePath = path.join(tempDir, fileName);
        
        while (await fs.access(filePath).then(() => true).catch(() => false)) {
          const nameParts = baseFileName.split('.');
          const extension = nameParts.pop();
          const baseName = nameParts.join('.');
          fileName = `${baseName}_${counter}.${extension}`;
          filePath = path.join(tempDir, fileName);
          counter++;
        }
        
        await fs.writeFile(filePath, buffer);
        
        // Return the original base64 as thumbnail (it's already the correct size)
        thumbnail = imageData;
      }

      // Clean up old images (older than 24 hours)
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      for (const file of files) {
        const fileStat = await fs.stat(path.join(tempDir, file));
        if (now - fileStat.mtimeMs > 24 * 60 * 60 * 1000) {
          await fs.unlink(path.join(tempDir, file)).catch(() => {});
        }
      }

      const finalName = path.basename(filePath);
      const finalSize = (await fs.stat(filePath)).size;
      
      console.log(`📸 Image saved: ${filePath} (${finalSize} bytes)`);
      
      return {
        success: true,
        path: filePath,
        thumbnail,
        name: finalName,
        size: finalSize
      };
    } catch (error) {
      console.error('Error saving image:', error);
      return { success: false, error: error.message };
    }
  });

  // Create terminal session
  ipcMain.handle('terminal:create', async (event, options) => {
    try {
      // Validate sender for security
      if (!event.senderFrame.url.includes('localhost') && !event.senderFrame.url.startsWith('file://')) {
        throw new Error('Unauthorized terminal creation request');
      }

      const terminalInfo = terminalManager.createTerminal(options);
      return terminalInfo;
    } catch (error) {
      console.error('Error creating terminal:', error);
      throw error;
    }
  });

  // Write to terminal
  ipcMain.handle('terminal:write', async (event, { sessionId, data }) => {
    try {
      // Validate sender for security
      if (!event.senderFrame.url.includes('localhost') && !event.senderFrame.url.startsWith('file://')) {
        throw new Error('Unauthorized terminal write request');
      }

      terminalManager.writeToTerminal(sessionId, data);
      return { success: true };
    } catch (error) {
      console.error('Error writing to terminal:', error);
      throw error;
    }
  });

  // Resize terminal
  ipcMain.handle('terminal:resize', async (event, { sessionId, cols, rows }) => {
    try {
      // Validate sender for security
      if (!event.senderFrame.url.includes('localhost') && !event.senderFrame.url.startsWith('file://')) {
        throw new Error('Unauthorized terminal resize request');
      }

      terminalManager.resizeTerminal(sessionId, cols, rows);
      return { success: true };
    } catch (error) {
      console.error('Error resizing terminal:', error);
      throw error;
    }
  });

  // Destroy terminal session
  ipcMain.handle('terminal:destroy', async (event, { sessionId }) => {
    try {
      // Validate sender for security
      if (!event.senderFrame.url.includes('localhost') && !event.senderFrame.url.startsWith('file://')) {
        throw new Error('Unauthorized terminal destroy request');
      }

      terminalManager.destroyTerminal(sessionId);
      return { success: true };
    } catch (error) {
      console.error('Error destroying terminal:', error);
      throw error;
    }
  });

  // Destroy all terminals for a project
  ipcMain.handle('terminal:destroyProject', async (event, { projectId }) => {
    try {
      // Validate sender for security
      if (!event.senderFrame.url.includes('localhost') && !event.senderFrame.url.startsWith('file://')) {
        throw new Error('Unauthorized terminal destroy request');
      }

      terminalManager.destroyProjectTerminals(projectId);
      return { success: true };
    } catch (error) {
      console.error('Error destroying project terminals:', error);
      throw error;
    }
  });

  // Get terminal info
  ipcMain.handle('terminal:getInfo', async (event, { sessionId }) => {
    try {
      const info = terminalManager.getTerminalInfo(sessionId);
      return info;
    } catch (error) {
      console.error('Error getting terminal info:', error);
      throw error;
    }
  });

  // Get all terminals
  ipcMain.handle('terminal:getAll', async (event) => {
    try {
      return terminalManager.getAllTerminals();
    } catch (error) {
      console.error('Error getting all terminals:', error);
      throw error;
    }
  });

  // Get project terminals
  ipcMain.handle('terminal:getProject', async (event, { projectId }) => {
    try {
      return terminalManager.getProjectTerminals(projectId);
    } catch (error) {
      console.error('Error getting project terminals:', error);
      throw error;
    }
  });


  // Forward terminal events to renderer
  terminalManager.on('terminal:data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', data);
    }
  });

  terminalManager.on('terminal:exit', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', data);
    }
  });

  terminalManager.on('terminal:error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:error', data);
    }
  });

  terminalManager.on('terminal:destroyed', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:destroyed', data);
    }
  });

  // Settings management IPC handlers
  ipcMain.handle('settings:getNetlifyToken', async () => {
    // In a real app, this would be stored in secure settings
    // For now, we'll use a simple approach
    try {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs').then(m => m.promises);
      
      const settingsPath = path.join(os.homedir(), '.faux', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      return settings.netlifyToken || null;
    } catch {
      return null;
    }
  });

  ipcMain.handle('settings:setNetlifyToken', async (event, token) => {
    try {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs').then(m => m.promises);
      
      const settingsDir = path.join(os.homedir(), '.faux');
      const settingsPath = path.join(settingsDir, 'settings.json');
      
      // Ensure settings directory exists
      await fs.mkdir(settingsDir, { recursive: true });
      
      let settings = {};
      try {
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        settings = JSON.parse(settingsData);
      } catch {
        // Settings file doesn't exist or is invalid, start fresh
      }
      
      settings.netlifyToken = token;
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      
      console.log('Netlify token saved to settings');
      return { success: true };
    } catch (error) {
      console.error('Failed to save Netlify token:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getDeploymentRecommendations', async () => {
    try {
      // Get token directly instead of using IPC call
      let token = null;
      try {
        const os = await import('os');
        const path = await import('path');
        const fs = await import('fs').then(m => m.promises);
        
        const settingsPath = path.join(os.homedir(), '.faux', 'settings.json');
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        token = settings.netlifyToken || null;
      } catch {
        // No token stored
      }
      
      return await getDeploymentRecommendations(token);
    } catch (error) {
      return {
        preferred: 'none',
        fallback: 'none',
        message: `Error checking deployment options: ${error.message}`
      };
    }
  });

  // Project deployment IPC handler with session management
  const deploymentManager = getDeploymentManager();
  
  // Set up deployment manager event forwarding
  deploymentManager.on('deploymentStarted', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('deployment:started', data);
    }
  });
  
  deploymentManager.on('deploymentProgress', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('project:deploy-progress', data);
    }
  });
  
  deploymentManager.on('deploymentComplete', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Update project in database if deployment was successful
      if (data.session.status === 'completed' && data.session.result?.success) {
        const updateData = {
          deploymentUrl: data.session.result.siteUrl || data.session.result.deployUrl,
          storybookUrl: data.session.result.storybookUrl,
          lastDeployedAt: new Date()
        };
        db.updateProject(data.projectId, updateData);
      }
      
      mainWindow.webContents.send('project:deploy-complete', {
        projectId: data.projectId,
        success: data.session.status === 'completed' && data.session.result?.success,
        siteUrl: data.session.result?.siteUrl,
        deployUrl: data.session.result?.deployUrl,
        error: data.session.error || data.session.result?.error,
        sessionId: data.sessionId
      });
    }
  });
  
  deploymentManager.on('deploymentBlocked', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('deployment:blocked', data);
    }
  });

  ipcMain.handle('project:deploy', async (event, projectId, options = {}) => {
    try {
      console.log('[IPC] Starting managed deployment for project:', projectId);
      
      const project = db.getProject(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Create deployment function that will be executed by the session
      const deploymentFunction = async (deployOptions) => {
        // Get stored API token
        let token = null;
        try {
          const os = await import('os');
          const path = await import('path');
          const fs = await import('fs').then(m => m.promises);
          
          const settingsPath = path.join(os.homedir(), '.faux', 'settings.json');
          const settingsData = await fs.readFile(settingsPath, 'utf8');
          const settings = JSON.parse(settingsData);
          token = settings.netlifyToken || null;
        } catch {
          // No token stored, will use CLI fallback
        }

        const finalDeployOptions = {
          projectPath: project.path,
          projectName: project.name,
          createNew: deployOptions.createNew !== false,
          existingUrl: deployOptions.createNew ? undefined : project.deploymentUrl,
          siteName: deployOptions.siteName,
          message: deployOptions.message || `Deploy ${project.name} from Faux`,
          token,
          onProgress: deployOptions.onProgress
        };

        return await deployToNetlify(finalDeployOptions);
      };

      // Start managed deployment
      const result = deploymentManager.startDeployment(projectId, deploymentFunction, options);
      
      return result;

    } catch (error) {
      console.error('[IPC] Project deployment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Additional IPC handlers for session management
  ipcMain.handle('deployment:cancel', async (event, projectId) => {
    try {
      const result = deploymentManager.cancelDeployment(projectId);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('deployment:getActive', async (event, projectId) => {
    try {
      const session = deploymentManager.getActiveSession(projectId);
      return session ? session.toJSON() : null;
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('deployment:getProjectHistory', async (event, projectId) => {
    try {
      return deploymentManager.getProjectSessions(projectId);
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('deployment:getAllActive', async (event) => {
    try {
      return deploymentManager.getAllActiveSessions();
    } catch (error) {
      return {};
    }
  });

  // Project deployment state IPC handler
  ipcMain.handle('project:getDeploymentState', async (event, projectId) => {
    try {
      const project = db.getProject(projectId);
      if (!project) {
        return { error: 'Project not found' };
      }
      
      return await getProjectDeploymentState(project);
    } catch (error) {
      console.error('Error getting project deployment state:', error);
      return { error: error.message };
    }
  });

  console.log('IPC handlers setup complete');
}