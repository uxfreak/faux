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
  }
});