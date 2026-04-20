// Preload script - runs in renderer process before web content loads
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashPlayer', {
  platform: process.platform,
  version: '3.2.6',
  isElectron: true,
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),
  // FFmpeg integration - local transcoding for full codec support
  ffmpegStatus: () => ipcRenderer.invoke('ffmpeg-status'),
  ffmpegProbe: (opts) => ipcRenderer.invoke('ffmpeg-probe', opts),
  ffmpegTranscodeUrl: (opts) => ipcRenderer.invoke('ffmpeg-transcode-url', opts),
  ffmpegSubtitleUrl: (opts) => ipcRenderer.invoke('ffmpeg-subtitle-url', opts),
  ffmpegRadioUrl: (opts) => ipcRenderer.invoke('ffmpeg-radio-url', opts),
  ffmpegStop: () => ipcRenderer.invoke('ffmpeg-stop'),
});
