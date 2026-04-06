// Preload script - runs in renderer process before web content loads
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('dashPlayer', {
  platform: process.platform,
  version: '1.0.0',
  isElectron: true,
});
