import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDatabase } from './src/main/database.js';
import { setupServerIPCHandlers, cleanupAllServers } from './src/main/serverManager.js';
import { getTerminalManager, cleanupTerminalManager } from './src/main/terminalManager.js';

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