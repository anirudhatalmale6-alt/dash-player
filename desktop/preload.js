// Preload script - runs in renderer process before web content loads
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashPlayer', {
  platform: process.platform,
  version: '2.9.4',
  isElectron: true,
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),
  // FFmpeg integration
  ffmpegStatus: () => ipcRenderer.invoke('ffmpeg-status'),
  ffmpegTranscodeUrl: (opts) => ipcRenderer.invoke('ffmpeg-transcode-url', opts),
  ffmpegProbe: (opts) => ipcRenderer.invoke('ffmpeg-probe', opts),
  ffmpegSubtitleUrl: (opts) => ipcRenderer.invoke('ffmpeg-subtitle-url', opts),
});
