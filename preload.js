const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any APIs you want to expose to the renderer process here
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
  },
  
  // Database API
  db: {
    getAllProjects: () => ipcRenderer.invoke('db:getAllProjects'),
    addProject: (projectData) => ipcRenderer.invoke('db:addProject', projectData),
    updateProject: (id, updates) => ipcRenderer.invoke('db:updateProject', id, updates),
    deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
    getProject: (id) => ipcRenderer.invoke('db:getProject', id)
  },

  // Server Management API
  startServers: (projectConfig) => ipcRenderer.invoke('server:start', projectConfig),
  stopServers: (projectId) => ipcRenderer.invoke('server:stop', projectId),
  getServerStatus: (projectId) => ipcRenderer.invoke('server:status', projectId),
  
  // Server event listeners
  onServerStatus: (callback) => {
    ipcRenderer.on('server:status-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('server:status-update');
  },
  onServerError: (callback) => {
    ipcRenderer.on('server:error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('server:error');
  },

  // Terminal Management API
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (sessionId, data) => ipcRenderer.invoke('terminal:write', { sessionId, data }),
    resize: (sessionId, cols, rows) => ipcRenderer.invoke('terminal:resize', { sessionId, cols, rows }),
    destroy: (sessionId) => ipcRenderer.invoke('terminal:destroy', { sessionId }),
    destroyProject: (projectId) => ipcRenderer.invoke('terminal:destroyProject', { projectId }),
    getInfo: (sessionId) => ipcRenderer.invoke('terminal:getInfo', { sessionId }),
    getAll: () => ipcRenderer.invoke('terminal:getAll'),
    getProject: (projectId) => ipcRenderer.invoke('terminal:getProject', { projectId })
  },

  // Terminal event listeners
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal:data', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('terminal:data');
  },
  onTerminalExit: (callback) => {
    ipcRenderer.on('terminal:exit', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('terminal:exit');
  },
  onTerminalError: (callback) => {
    ipcRenderer.on('terminal:error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('terminal:error');
  },
  onTerminalDestroyed: (callback) => {
    ipcRenderer.on('terminal:destroyed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('terminal:destroyed');
  },

  // Project scaffolding API
  scaffoldProject: (options) => ipcRenderer.invoke('project:scaffold', options),
  onScaffoldProgress: (callback) => {
    ipcRenderer.on('project:scaffold-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:scaffold-progress');
  }
});