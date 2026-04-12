// Preload script - runs in renderer process before web content loads
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashPlayer', {
  platform: process.platform,
  version: '2.9.5',
  isElectron: true,
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),
  // MPV integration - native media player for full codec support
  mpvStatus: () => ipcRenderer.invoke('mpv-status'),
  mpvPlay: (opts) => ipcRenderer.invoke('mpv-play', opts),
  mpvStop: () => ipcRenderer.invoke('mpv-stop'),
  mpvCommand: (opts) => ipcRenderer.invoke('mpv-command', opts),
  mpvGetProperty: (opts) => ipcRenderer.invoke('mpv-get-property', opts),
  mpvSetProperty: (opts) => ipcRenderer.invoke('mpv-set-property', opts),
  mpvGetTracks: () => ipcRenderer.invoke('mpv-get-tracks'),
  mpvSetAudioTrack: (opts) => ipcRenderer.invoke('mpv-set-audio-track', opts),
  mpvSetSubtitleTrack: (opts) => ipcRenderer.invoke('mpv-set-subtitle-track', opts),
  onMpvStopped: (callback) => ipcRenderer.on('mpv-stopped', callback),
});
