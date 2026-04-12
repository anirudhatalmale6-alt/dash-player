const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const http = require('http');
const os = require('os');

// Enable proprietary codecs (H.265/HEVC), audio track selection, and hardware acceleration
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,MediaFoundationH265Decoding,AudioTrackSelection');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

/* ══════ FFmpeg Integration ══════ */
let ffmpegPath = null;
let transcodingServer = null;
let transcodingPort = 0;
const activeTranscodes = new Map(); // port -> { process, url }

function detectFFmpeg() {
  const candidates = process.platform === 'win32'
    ? ['ffmpeg.exe', 'C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
       path.join(app.getPath('userData'), 'ffmpeg.exe')]
    : ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

  for (const candidate of candidates) {
    try {
      const result = require('child_process').execFileSync(candidate, ['-version'], {
        timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
      });
      if (result.toString().includes('ffmpeg')) {
        ffmpegPath = candidate;
        console.log('[FFmpeg] Found:', ffmpegPath);
        return true;
      }
    } catch (e) { /* not found, try next */ }
  }
  console.log('[FFmpeg] Not found on system');
  return false;
}

function startTranscodingServer() {
  transcodingServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const streamUrl = url.searchParams.get('url');
    const mode = url.searchParams.get('mode') || 'transcode'; // transcode | probe | subtitle

    if (!streamUrl) {
      res.writeHead(400); res.end('Missing url parameter'); return;
    }

    if (mode === 'probe') {
      // Probe stream for track info using ffmpeg -i
      const args = ['-i', streamUrl, '-hide_banner', '-show_streams', '-show_format',
                    '-print_format', 'json', '-v', 'quiet'];
      // Use ffprobe if available, else ffmpeg
      const probePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
      execFile(probePath, args, { timeout: 15000 }, (err, stdout, stderr) => {
        if (err) {
          // Fallback: use ffmpeg -i which outputs to stderr
          execFile(ffmpegPath, ['-i', streamUrl, '-hide_banner'], { timeout: 15000 },
            (err2, stdout2, stderr2) => {
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ raw: (stderr2 || '').toString(), type: 'ffmpeg' }));
            });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ...JSON.parse(stdout), type: 'ffprobe' }));
      });
      return;
    }

    if (mode === 'subtitle') {
      const trackIndex = parseInt(url.searchParams.get('track') || '0');
      res.writeHead(200, {
        'Content-Type': 'text/vtt', 'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      const ffProc = spawn(ffmpegPath, [
        '-i', streamUrl, '-map', `0:s:${trackIndex}`,
        '-f', 'webvtt', '-v', 'quiet', 'pipe:1'
      ]);
      ffProc.stdout.pipe(res);
      ffProc.stderr.on('data', (d) => console.log('[FFmpeg subtitle]', d.toString()));
      ffProc.on('error', () => { res.end(); });
      ffProc.on('exit', () => { res.end(); });
      req.on('close', () => { ffProc.kill(); });
      return;
    }

    // mode === 'transcode': transcode live stream (copy video, convert audio to AAC)
    res.writeHead(200, {
      'Content-Type': 'video/mp2t', 'Access-Control-Allow-Origin': '*',
      'Transfer-Encoding': 'chunked', 'Cache-Control': 'no-cache',
    });

    const audioTrack = url.searchParams.get('audio');
    const audioMap = audioTrack ? ['-map', '0:v:0', '-map', `0:a:${audioTrack}`] : ['-map', '0:v:0', '-map', '0:a:0?'];

    const ffProc = spawn(ffmpegPath, [
      '-re', '-i', streamUrl,
      ...audioMap,
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
      '-f', 'mpegts', '-v', 'quiet', 'pipe:1'
    ]);

    ffProc.stdout.pipe(res);
    ffProc.stderr.on('data', (d) => console.log('[FFmpeg transcode]', d.toString()));
    ffProc.on('error', (err) => { console.log('[FFmpeg error]', err); res.end(); });
    ffProc.on('exit', (code) => { console.log('[FFmpeg exit]', code); res.end(); });
    req.on('close', () => { ffProc.kill(); });
  });

  transcodingServer.listen(0, '127.0.0.1', () => {
    transcodingPort = transcodingServer.address().port;
    console.log('[FFmpeg] Transcoding server on port', transcodingPort);
  });
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

  return win;
}

// IPC handlers for proxy/VPN
ipcMain.handle('set-proxy', async (event, config) => {
  try {
    // config: { protocol: 'socks5'|'http', server: string, port: string, username?: string, password?: string }
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

// FFmpeg IPC handlers
ipcMain.handle('ffmpeg-status', () => ({
  available: !!ffmpegPath,
  path: ffmpegPath,
  port: transcodingPort,
}));

ipcMain.handle('ffmpeg-transcode-url', (event, { url, audioTrack }) => {
  if (!ffmpegPath || !transcodingPort) return null;
  const params = new URLSearchParams({ url, mode: 'transcode' });
  if (audioTrack !== undefined) params.set('audio', audioTrack);
  return `http://127.0.0.1:${transcodingPort}/?${params}`;
});

ipcMain.handle('ffmpeg-probe', async (event, { url }) => {
  if (!ffmpegPath || !transcodingPort) return null;
  try {
    const res = await new Promise((resolve, reject) => {
      const probeUrl = `http://127.0.0.1:${transcodingPort}/?mode=probe&url=${encodeURIComponent(url)}`;
      http.get(probeUrl, (resp) => {
        let data = '';
        resp.on('data', (c) => data += c);
        resp.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      }).on('error', reject);
    });
    return res;
  } catch (e) {
    console.log('[FFmpeg probe error]', e.message);
    return null;
  }
});

ipcMain.handle('ffmpeg-subtitle-url', (event, { url, trackIndex }) => {
  if (!ffmpegPath || !transcodingPort) return null;
  return `http://127.0.0.1:${transcodingPort}/?mode=subtitle&url=${encodeURIComponent(url)}&track=${trackIndex}`;
});

app.whenReady().then(() => {
  // Detect FFmpeg and start transcoding server
  detectFFmpeg();
  if (ffmpegPath) {
    startTranscodingServer();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Set app user model ID for Windows
app.setAppUserModelId('tv.dashplayer.app');
