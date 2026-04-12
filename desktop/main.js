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

/* ══════ FFmpeg Integration ══════ */
let ffmpegPath = null;
let ffmpegProcess = null;
let localServer = null;
let localServerPort = 0;
let mainWindow = null;

function findBinary(name) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  // Check bundled (extraResources)
  const bundled = path.join(process.resourcesPath || path.join(__dirname, 'resources'), 'ffmpeg', name + ext);
  if (fs.existsSync(bundled)) {
    console.log(`[FFmpeg] Found bundled ${name}:`, bundled);
    return bundled;
  }
  // Check system PATH
  const candidates = process.platform === 'win32'
    ? [`${name}.exe`, `C:\\ffmpeg\\bin\\${name}.exe`, `C:\\ffmpeg\\${name}.exe`,
       `C:\\Program Files\\ffmpeg\\bin\\${name}.exe`, `C:\\Program Files (x86)\\ffmpeg\\bin\\${name}.exe`]
    : [name, `/usr/bin/${name}`, `/usr/local/bin/${name}`];
  for (const c of candidates) {
    try {
      require('child_process').execFileSync(c, ['-version'], { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] });
      console.log(`[FFmpeg] Found system ${name}:`, c);
      return c;
    } catch (e) { /* not found */ }
  }
  console.log(`[FFmpeg] ${name} not found`);
  return null;
}

function stopFfmpeg() {
  if (ffmpegProcess) {
    try { ffmpegProcess.kill('SIGKILL'); } catch(e) {}
    ffmpegProcess = null;
  }
}

// Start a local HTTP server that pipes FFmpeg output to the browser
function ensureLocalServer() {
  return new Promise((resolve) => {
    if (localServer && localServerPort) { resolve(localServerPort); return; }

    localServer = http.createServer((req, res) => {
      // The request URL contains the encoded source URL and options
      const url = new URL(req.url, `http://localhost`);
      const sourceUrl = url.searchParams.get('url');
      const audioTrack = url.searchParams.get('audio') || '0';
      const mode = url.searchParams.get('mode') || 'transcode'; // transcode | subtitle

      if (!sourceUrl) { res.writeHead(400); res.end('Missing url'); return; }

      if (mode === 'subtitle') {
        // Extract subtitle track as WebVTT
        const subIndex = url.searchParams.get('subIndex') || '0';
        console.log(`[FFmpeg] Extracting subtitle track ${subIndex} from:`, sourceUrl);
        res.writeHead(200, {
          'Content-Type': 'text/vtt',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        });
        const proc = spawn(ffmpegPath, [
          '-i', sourceUrl,
          '-map', `0:s:${subIndex}`,
          '-f', 'webvtt',
          'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        proc.stdout.pipe(res);
        proc.stderr.on('data', (d) => console.log('[FFmpeg sub]', d.toString().trim()));
        proc.on('error', () => { res.end(); });
        req.on('close', () => { try { proc.kill(); } catch(e) {} });
        return;
      }

      // Transcode mode: remux stream with audio transcoded to AAC
      console.log(`[FFmpeg] Transcoding (audio track ${audioTrack}):`, sourceUrl);
      stopFfmpeg();

      const isLive = sourceUrl.includes('/live/') || sourceUrl.includes('/timeshift/');

      const args = [
        '-hide_banner', '-loglevel', 'warning',
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-i', sourceUrl,
        '-map', '0:v:0',
        '-map', `0:a:${audioTrack}`,
        '-c:v', 'copy',     // copy video (no re-encode)
        '-c:a', 'aac',      // transcode audio to AAC (browser-compatible)
        '-b:a', '192k',
        '-ac', '2',
        '-f', 'mp4',        // fragmented MP4 - Chrome can play this directly
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1',
      ];

      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      ffmpegProcess.stdout.pipe(res);
      ffmpegProcess.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) console.log('[FFmpeg]', msg);
      });
      ffmpegProcess.on('exit', (code) => {
        console.log('[FFmpeg] Process exited with code', code);
        ffmpegProcess = null;
        res.end();
      });
      ffmpegProcess.on('error', (err) => {
        console.log('[FFmpeg] Process error:', err.message);
        ffmpegProcess = null;
        res.end();
      });

      req.on('close', () => {
        console.log('[FFmpeg] Client disconnected, stopping');
        stopFfmpeg();
      });
    });

    localServer.listen(0, '127.0.0.1', () => {
      localServerPort = localServer.address().port;
      console.log('[FFmpeg] Local server on port', localServerPort);
      resolve(localServerPort);
    });
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

  mainWindow = win;
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools();
  }

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') win.webContents.toggleDevTools();
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
  });

  win.on('closed', () => { stopFfmpeg(); mainWindow = null; });
  return win;
}

// IPC: Proxy
ipcMain.handle('set-proxy', async (event, config) => {
  try {
    let proxyUrl;
    if (config.username && config.password) {
      proxyUrl = `${config.protocol}://${config.username}:${config.password}@${config.server}:${config.port}`;
    } else {
      proxyUrl = `${config.protocol}://${config.server}:${config.port}`;
    }
    await session.defaultSession.setProxy({ proxyRules: proxyUrl });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clear-proxy', async () => {
  try {
    await session.defaultSession.setProxy({ proxyRules: '' });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/* ══════ FFmpeg IPC Handlers ══════ */

// Check FFmpeg availability
ipcMain.handle('ffmpeg-status', () => ({
  available: !!ffmpegPath,
  ffmpegPath,
  port: localServerPort,
}));

// Probe media file with ffmpeg -i (get audio/subtitle tracks)
ipcMain.handle('ffmpeg-probe', async (event, { url }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };

  return new Promise((resolve) => {
    // ffmpeg -i <url> exits with error (no output specified) but prints stream info to stderr
    execFile(ffmpegPath, ['-i', url, '-hide_banner'], { timeout: 15000 }, (err, stdout, stderr) => {
      const output = stderr || '';
      if (!output) {
        resolve({ success: false, error: 'No output from ffmpeg' });
        return;
      }
      try {
        const audio = [];
        const subtitle = [];
        let audioIdx = 0, subIdx = 0;

        // Parse lines like: Stream #0:1(tur): Audio: aac (HE-AAC), 48000 Hz, stereo
        // Or: Stream #0:1(tur): Audio: aac ... (default)
        // Title lines: title           : Turkish
        const lines = output.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const audioMatch = line.match(/Stream #\d+:(\d+)(?:\((\w+)\))?.*?Audio:\s*(\w+)/);
          const subMatch = line.match(/Stream #\d+:(\d+)(?:\((\w+)\))?.*?Subtitle:\s*(\w+)/);

          if (audioMatch) {
            // Check next lines for title metadata
            let title = '';
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              const titleMatch = lines[j].match(/^\s+title\s*:\s*(.+)$/i);
              if (titleMatch) { title = titleMatch[1].trim(); break; }
              if (lines[j].match(/Stream #/)) break;
            }
            audio.push({
              index: audioIdx++,
              streamIndex: parseInt(audioMatch[1]),
              codec: audioMatch[3],
              lang: audioMatch[2] || '',
              title: title,
            });
          }

          if (subMatch) {
            let title = '';
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              const titleMatch = lines[j].match(/^\s+title\s*:\s*(.+)$/i);
              if (titleMatch) { title = titleMatch[1].trim(); break; }
              if (lines[j].match(/Stream #/)) break;
            }
            subtitle.push({
              index: subIdx++,
              streamIndex: parseInt(subMatch[1]),
              codec: subMatch[3],
              lang: subMatch[2] || '',
              title: title,
            });
          }
        }

        console.log(`[FFmpeg probe] Found ${audio.length} audio, ${subtitle.length} subtitle tracks`);
        resolve({ success: true, audio, subtitle });
      } catch (e) {
        console.log('[FFmpeg probe] Parse error:', e.message);
        resolve({ success: false, error: 'Failed to parse probe data' });
      }
    });
  });
});

// Get local transcode URL (browser will connect to our local server)
ipcMain.handle('ffmpeg-transcode-url', async (event, { url, audioTrack }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };
  const port = await ensureLocalServer();
  const transUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&audio=${audioTrack || 0}&mode=transcode`;
  console.log('[FFmpeg] Transcode URL:', transUrl);
  return { success: true, url: transUrl };
});

// Get subtitle extraction URL
ipcMain.handle('ffmpeg-subtitle-url', async (event, { url, subIndex }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };
  const port = await ensureLocalServer();
  const subUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&subIndex=${subIndex || 0}&mode=subtitle`;
  console.log('[FFmpeg] Subtitle URL:', subUrl);
  return { success: true, url: subUrl };
});

// Stop current FFmpeg process
ipcMain.handle('ffmpeg-stop', () => {
  stopFfmpeg();
  return { success: true };
});

app.whenReady().then(() => {
  ffmpegPath = findBinary('ffmpeg');

  // Start the local server immediately if FFmpeg is available
  if (ffmpegPath) ensureLocalServer();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopFfmpeg();
  if (localServer) { try { localServer.close(); } catch(e) {} }
  if (process.platform !== 'darwin') app.quit();
});

app.setAppUserModelId('tv.dashplayer.app');
