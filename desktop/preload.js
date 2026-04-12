// Preload script - runs in renderer process before web content loads
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashPlayer', {
  platform: process.platform,
  version: '2.6.0',
  isElectron: true,
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),
});
