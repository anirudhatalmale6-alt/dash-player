const { app, BrowserWindow, session, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

// Enable proprietary codecs (H.265/HEVC), audio track selection, and hardware acceleration
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,MediaFoundationH265Decoding,AudioTrackSelection');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

/* ══════ MPV Player Integration ══════ */
let mpvPath = null;
let mpvProcess = null;
let mpvIpcPath = null;
let mpvReady = false;
let mainWindow = null;
let pendingCommands = [];
let commandId = 0;
let commandCallbacks = new Map();

function getMpvPath() {
  // Check bundled mpv first (in extraResources)
  const bundled = process.platform === 'win32'
    ? path.join(process.resourcesPath || path.join(__dirname, 'resources'), 'mpv', 'mpv.exe')
    : path.join(process.resourcesPath || path.join(__dirname, 'resources'), 'mpv', 'mpv');

  if (fs.existsSync(bundled)) {
    console.log('[MPV] Found bundled:', bundled);
    return bundled;
  }

  // Check system PATH
  const systemCandidates = process.platform === 'win32'
    ? ['mpv.exe', 'C:\\mpv\\mpv.exe', 'C:\\Program Files\\mpv\\mpv.exe']
    : ['mpv', '/usr/bin/mpv', '/usr/local/bin/mpv'];

  for (const candidate of systemCandidates) {
    try {
      require('child_process').execFileSync(candidate, ['--version'], {
        timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
      });
      console.log('[MPV] Found system:', candidate);
      return candidate;
    } catch (e) { /* not found */ }
  }

  console.log('[MPV] Not found');
  return null;
}

// Send command to mpv via JSON IPC
function mpvCommand(args) {
  return new Promise((resolve, reject) => {
    if (!mpvProcess || !mpvReady) {
      reject(new Error('MPV not ready'));
      return;
    }
    const id = ++commandId;
    const cmd = JSON.stringify({ command: args, request_id: id }) + '\n';
    commandCallbacks.set(id, { resolve, reject, timeout: setTimeout(() => {
      commandCallbacks.delete(id);
      reject(new Error('MPV command timeout'));
    }, 5000) });

    try {
      if (process.platform === 'win32') {
        // Windows named pipe
        const client = net.connect(mpvIpcPath, () => {
          client.write(cmd);
        });
        let data = '';
        client.on('data', (chunk) => { data += chunk; });
        client.on('end', () => {
          try {
            const lines = data.trim().split('\n');
            for (const line of lines) {
              const resp = JSON.parse(line);
              if (resp.request_id && commandCallbacks.has(resp.request_id)) {
                const cb = commandCallbacks.get(resp.request_id);
                clearTimeout(cb.timeout);
                commandCallbacks.delete(resp.request_id);
                if (resp.error === 'success') cb.resolve(resp.data);
                else cb.reject(new Error(resp.error));
              }
            }
          } catch (e) { /* parse error */ }
        });
        client.on('error', (err) => {
          const cb = commandCallbacks.get(id);
          if (cb) { clearTimeout(cb.timeout); commandCallbacks.delete(id); cb.reject(err); }
        });
      } else {
        // Unix socket
        const client = net.connect(mpvIpcPath, () => {
          client.write(cmd);
          client.end();
        });
        let data = '';
        client.on('data', (chunk) => { data += chunk; });
        client.on('end', () => {
          try {
            const resp = JSON.parse(data.trim().split('\n').pop());
            const cb = commandCallbacks.get(id);
            if (cb) {
              clearTimeout(cb.timeout);
              commandCallbacks.delete(id);
              if (resp.error === 'success') cb.resolve(resp.data);
              else cb.reject(new Error(resp.error));
            }
          } catch (e) { /* parse error */ }
        });
      }
    } catch (e) {
      const cb = commandCallbacks.get(id);
      if (cb) { clearTimeout(cb.timeout); commandCallbacks.delete(id); cb.reject(e); }
    }
  });
}

// Get mpv property
async function mpvGetProperty(name) {
  return mpvCommand(['get_property', name]);
}

// Set mpv property
async function mpvSetProperty(name, value) {
  return mpvCommand(['set_property', name, value]);
}

function stopMpv() {
  if (mpvProcess) {
    try { mpvProcess.kill(); } catch(e) {}
    mpvProcess = null;
    mpvReady = false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'Dash Player',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#f7f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow = win;

  // Load the built React app
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Open DevTools with F12 or --dev flag
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools();
  }

  // Keyboard shortcuts: F11 fullscreen, F12 DevTools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
    }
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
    }
    if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });

  // Stop mpv when window closes
  win.on('closed', () => { stopMpv(); mainWindow = null; });

  return win;
}

// IPC handlers for proxy/VPN
ipcMain.handle('set-proxy', async (event, config) => {
  try {
    let proxyUrl;
    if (config.username && config.password) {
      proxyUrl = `${config.protocol}://${config.username}:${config.password}@${config.server}:${config.port}`;
    } else {
      proxyUrl = `${config.protocol}://${config.server}:${config.port}`;
    }
    await session.defaultSession.setProxy({ proxyRules: proxyUrl });
    console.log('Proxy set:', proxyUrl.replace(/:[^:@]+@/, ':***@'));
    return { success: true };
  } catch (err) {
    console.error('Failed to set proxy:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clear-proxy', async () => {
  try {
    await session.defaultSession.setProxy({ proxyRules: '' });
    console.log('Proxy cleared');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/* ══════ MPV IPC Handlers ══════ */
ipcMain.handle('mpv-status', () => ({
  available: !!mpvPath,
  path: mpvPath,
  ready: mpvReady,
}));

ipcMain.handle('mpv-play', async (event, { url, isLive }) => {
  if (!mpvPath) return { success: false, error: 'MPV not available' };

  // Stop any existing mpv process
  stopMpv();

  // Set up IPC pipe path
  mpvIpcPath = process.platform === 'win32'
    ? '\\\\.\\pipe\\dashplayer-mpv-' + process.pid
    : '/tmp/dashplayer-mpv-' + process.pid + '.sock';

  // Clean up old socket on unix
  if (process.platform !== 'win32') {
    try { fs.unlinkSync(mpvIpcPath); } catch(e) {}
  }

  const args = [
    '--no-terminal',
    '--force-window=yes',
    '--keep-open=yes',
    '--no-border',
    '--ontop',
    '--title=DashPlayer Video',
    '--input-ipc-server=' + mpvIpcPath,
    '--osd-level=0',
    '--hwdec=auto',
    '--volume=100',
    '--cache=yes',
    '--demuxer-max-bytes=50M',
  ];

  if (isLive) {
    args.push('--cache-secs=5', '--demuxer-readahead-secs=3');
  }

  args.push('--', url);

  console.log('[MPV] Starting:', mpvPath, args.join(' '));
  mpvProcess = spawn(mpvPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: false,
  });

  mpvProcess.stdout.on('data', (d) => console.log('[MPV out]', d.toString().trim()));
  mpvProcess.stderr.on('data', (d) => console.log('[MPV err]', d.toString().trim()));
  mpvProcess.on('exit', (code) => {
    console.log('[MPV] Exited with code', code);
    mpvReady = false;
    mpvProcess = null;
    // Notify renderer that mpv stopped
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mpv-stopped');
    }
  });

  // Wait for IPC to become available
  await new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      if (attempts > 20) { resolve(); return; } // give up after 2 seconds
      try {
        const client = net.connect(mpvIpcPath, () => {
          client.end();
          mpvReady = true;
          console.log('[MPV] IPC ready');
          resolve();
        });
        client.on('error', () => { setTimeout(check, 100); });
      } catch(e) { setTimeout(check, 100); }
    };
    setTimeout(check, 200);
  });

  return { success: true, ready: mpvReady };
});

ipcMain.handle('mpv-stop', () => {
  stopMpv();
  return { success: true };
});

ipcMain.handle('mpv-command', async (event, { command }) => {
  try {
    const result = await mpvCommand(command);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('mpv-get-property', async (event, { name }) => {
  try {
    const result = await mpvGetProperty(name);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('mpv-set-property', async (event, { name, value }) => {
  try {
    await mpvSetProperty(name, value);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Get audio/subtitle track info from mpv
ipcMain.handle('mpv-get-tracks', async () => {
  try {
    const count = await mpvGetProperty('track-list/count');
    const tracks = { audio: [], subtitle: [] };
    for (let i = 0; i < count; i++) {
      const type = await mpvGetProperty(`track-list/${i}/type`);
      const id = await mpvGetProperty(`track-list/${i}/id`);
      const lang = await mpvGetProperty(`track-list/${i}/lang`).catch(() => '');
      const title = await mpvGetProperty(`track-list/${i}/title`).catch(() => '');
      const selected = await mpvGetProperty(`track-list/${i}/selected`).catch(() => false);
      if (type === 'audio') {
        tracks.audio.push({ id, lang: lang || '', title: title || '', selected });
      } else if (type === 'sub') {
        tracks.subtitle.push({ id, lang: lang || '', title: title || '', selected });
      }
    }
    return { success: true, data: tracks };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Switch audio track
ipcMain.handle('mpv-set-audio-track', async (event, { trackId }) => {
  try {
    await mpvSetProperty('aid', trackId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Switch subtitle track (-1 or 'no' to disable)
ipcMain.handle('mpv-set-subtitle-track', async (event, { trackId }) => {
  try {
    await mpvSetProperty('sid', trackId <= 0 ? 'no' : trackId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

app.whenReady().then(() => {
  // Detect mpv (bundled or system)
  mpvPath = getMpvPath();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopMpv();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Set app user model ID for Windows
app.setAppUserModelId('tv.dashplayer.app');
