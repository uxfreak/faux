import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDatabase } from './src/main/database.js';
import { setupServerIPCHandlers, cleanupAllServers } from './src/main/serverManager.js';
import { getTerminalManager, cleanupTerminalManager } from './src/main/terminalManager.js';
import { getThumbnailService } from './src/main/thumbnailService.js';
import { duplicateProjectFiles } from './src/main/projectScaffold.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;

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
    mainWindow.loadFile(join(__dirname, 'dist/index.html'));
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
        console.log('📤 Sending thumbnail update event for project:', projectId);
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
        console.log('📤 Sending thumbnail update event for project:', projectId);
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
        console.log('📤 Sending thumbnail update event for project:', projectId);
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

  console.log('IPC handlers setup complete');
}