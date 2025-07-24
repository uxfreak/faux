import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDatabase } from './src/main/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.js')
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
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

  console.log('IPC handlers setup complete');
}