const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tj', {
  getUrl: () => ipcRenderer.invoke('tj:getUrl'),
  saveUrl: url => ipcRenderer.invoke('tj:saveUrl', url),
  retry: () => ipcRenderer.invoke('tj:retry')
});
