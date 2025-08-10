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
  },

  // Project rename API
  renameProject: (projectId, newName) => ipcRenderer.invoke('project:rename', { projectId, newName }),
  onProjectRenamed: (callback) => {
    ipcRenderer.on('project:renamed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:renamed');
  },

  // Project duplication API
  duplicateProject: (projectId, customName) => ipcRenderer.invoke('project:duplicate', { projectId, customName }),
  onDuplicateProgress: (callback) => {
    ipcRenderer.on('project:duplicate-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:duplicate-progress');
  },
  onDuplicateComplete: (callback) => {
    ipcRenderer.on('project:duplicate-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:duplicate-complete');
  },

  // Thumbnail API
  thumbnail: {
    capture: (projectId, serverUrl, options) => ipcRenderer.invoke('thumbnail:capture', { projectId, serverUrl, options }),
    debouncedCapture: (projectId, serverUrl, debounceMs, options) => ipcRenderer.invoke('thumbnail:debouncedCapture', { projectId, serverUrl, debounceMs, options }),
    checkServer: (serverUrl) => ipcRenderer.invoke('thumbnail:checkServer', { serverUrl }),
    generateFallback: (projectId, projectName, options) => ipcRenderer.invoke('thumbnail:generateFallback', { projectId, projectName, options }),
    clearAll: () => ipcRenderer.invoke('thumbnail:clearAll')
  },

  // Thumbnail event listeners
  onThumbnailUpdated: (callback) => {
    ipcRenderer.on('project:thumbnail-updated', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:thumbnail-updated');
  },
  onThumbnailsCleared: (callback) => {
    ipcRenderer.on('project:thumbnails-cleared', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:thumbnails-cleared');
  },

  // Deployment API
  deployProject: (projectId, options) => ipcRenderer.invoke('project:deploy', projectId, options),
  getProjectDeploymentState: (projectId) => ipcRenderer.invoke('project:getDeploymentState', projectId),
  onDeployProgress: (callback) => {
    ipcRenderer.on('project:deploy-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:deploy-progress');
  },
  onDeployComplete: (callback) => {
    ipcRenderer.on('project:deploy-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('project:deploy-complete');
  },

  // Deployment Session Management API
  deployment: {
    cancel: (projectId) => ipcRenderer.invoke('deployment:cancel', projectId),
    getActiveSession: (projectId) => ipcRenderer.invoke('deployment:getActive', projectId),
    getProjectHistory: (projectId) => ipcRenderer.invoke('deployment:getProjectHistory', projectId),
    getAllActiveSessions: () => ipcRenderer.invoke('deployment:getAllActive')
  },
  
  // Deployment Session Events
  onDeploymentStarted: (callback) => {
    ipcRenderer.on('deployment:started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('deployment:started');
  },
  onDeploymentBlocked: (callback) => {
    ipcRenderer.on('deployment:blocked', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('deployment:blocked');
  },

  // Settings API
  settings: {
    getNetlifyToken: () => ipcRenderer.invoke('settings:getNetlifyToken'),
    setNetlifyToken: (token) => ipcRenderer.invoke('settings:setNetlifyToken', token),
    getDeploymentRecommendations: () => ipcRenderer.invoke('settings:getDeploymentRecommendations')
  },

  // External link support
  openExternal: (url) => {
    // This would be implemented if needed
    console.log('Would open external URL:', url);
  }

});