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
const os = require('os');
const subtitleCache = new Map(); // url+index -> { path, ready, error }
let subtitleExtractProcs = []; // track running extraction processes

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

let currentTranscodeResponse = null; // track active HTTP response to end it on stop

function stopFfmpeg() {
  if (ffmpegProcess) {
    const pid = ffmpegProcess.pid;
    console.log('[FFmpeg] Stopping process PID:', pid);
    try {
      // On Windows, SIGKILL doesn't kill child processes. Use taskkill /T to kill process tree.
      if (process.platform === 'win32' && pid) {
        require('child_process').exec(`taskkill /PID ${pid} /T /F`, () => {});
      } else {
        ffmpegProcess.kill('SIGKILL');
      }
    } catch(e) { console.log('[FFmpeg] Kill error:', e.message); }
    ffmpegProcess = null;
  }
  // End the current HTTP response so browser stops waiting
  if (currentTranscodeResponse) {
    try { currentTranscodeResponse.end(); } catch(e) {}
    currentTranscodeResponse = null;
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

      if (mode === 'subtitle-file') {
        // Serve a pre-extracted subtitle temp file
        const filePath = url.searchParams.get('path');
        if (!filePath || !fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          res.end('Subtitle file not found');
          return;
        }
        console.log('[FFmpeg sub] Serving cached subtitle file:', filePath);
        const data = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          'Content-Length': data.length,
        });
        res.end(data);
        return;
      }

      if (!sourceUrl) { res.writeHead(400); res.end('Missing url'); return; }

      if (mode === 'subtitle') {
        // Extract subtitle track as WebVTT via pipe - streams data as it becomes available
        const subIndex = url.searchParams.get('subIndex') || '0';
        const cacheKey = `${sourceUrl}::${subIndex}`;
        console.log(`[FFmpeg] Extracting subtitle track ${subIndex} from:`, sourceUrl);
        const subUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';
        const proc = spawn(ffmpegPath, [
          '-hide_banner', '-loglevel', 'info',
          '-user_agent', subUa,
          '-probesize', '100000000',      // 100MB probe for large MKV
          '-analyzeduration', '30000000', // 30 seconds analysis
          '-i', sourceUrl,
          '-map', `0:s:${subIndex}`,
          '-an', '-vn',                   // skip audio+video = faster extraction
          '-c:s', 'webvtt',
          '-f', 'webvtt',
          'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        // Kill subtitle extraction after 120 seconds if no data
        const subTimeout = setTimeout(() => {
          if (!hasData) {
            console.log('[FFmpeg sub] Timeout - no subtitle data after 120s');
            try { proc.kill(); } catch(e) {}
          }
        }, 120000);

        let hasData = false;
        let stderrLog = '';
        let allData = [];
        proc.stdout.on('data', (chunk) => {
          if (!hasData) {
            hasData = true;
            console.log('[FFmpeg sub] First subtitle data received');
            res.writeHead(200, {
              'Content-Type': 'text/vtt; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            });
          }
          allData.push(chunk);
          res.write(chunk);
        });
        proc.stderr.on('data', (d) => {
          const msg = d.toString();
          stderrLog += msg;
          const lines = msg.split('\n').filter(l => l.trim() && !l.includes('frame=') && !l.includes('size='));
          lines.forEach(l => { if (l.trim()) console.log('[FFmpeg sub]', l.trim()); });
        });
        proc.on('exit', (code) => {
          clearTimeout(subTimeout);
          if (!hasData) {
            console.log('[FFmpeg sub] No subtitle data produced. Code:', code, 'stderr:', stderrLog.slice(-500).trim());
            res.writeHead(200, { 'Content-Type': 'text/vtt', 'Access-Control-Allow-Origin': '*' });
            res.end('WEBVTT\n\n'); // empty valid WebVTT
          } else {
            console.log('[FFmpeg sub] Subtitle extraction complete, caching result');
            // Cache to temp file for future requests
            const tmpFile = path.join(os.tmpdir(), `dashplayer-sub-${Date.now()}-${subIndex}.vtt`);
            try {
              fs.writeFileSync(tmpFile, Buffer.concat(allData));
              subtitleCache.set(cacheKey, { ready: true, path: tmpFile });
            } catch(e) { console.log('[FFmpeg sub] Cache write error:', e.message); }
            res.end();
          }
        });
        proc.on('error', (e) => {
          console.log('[FFmpeg sub] Process error:', e.message);
          if (!hasData) { res.writeHead(500); }
          res.end();
        });
        req.on('close', () => { try { proc.kill(); } catch(e) {} });
        return;
      }

      // Transcode mode: remux stream with audio transcoded to AAC
      console.log(`[FFmpeg] Transcoding (audio track ${audioTrack}):`, sourceUrl);
      stopFfmpeg(); // Kill previous FFmpeg + end previous response
      currentTranscodeResponse = res; // Track this response

      const isLive = sourceUrl.includes('/live/') || sourceUrl.includes('/timeshift/');
      const subCount = parseInt(url.searchParams.get('subs') || '0');

      // Use browser-like User-Agent so IPTV server counts FFmpeg as same client
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';

      const args = [
        '-hide_banner', '-loglevel', 'info',
        '-user_agent', userAgent,
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-probesize', isLive ? '10000000' : '50000000',
        '-analyzeduration', isLive ? '5000000' : '15000000',
        '-i', sourceUrl,
        '-map', '0:v:0?',             // ? = optional, won't fail if missing
        '-map', `0:a:${audioTrack}?`,
        '-c:v', 'copy',               // copy video (no re-encode)
        '-c:a', 'aac',                // transcode audio to AAC
        '-b:a', '192k',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1',
      ];

      // For VOD with subtitles: extract subtitle tracks to temp files simultaneously
      // This uses the SAME FFmpeg connection - no extra connections to IPTV server!
      const subTmpFiles = [];
      if (!isLive && subCount > 0) {
        for (let i = 0; i < subCount; i++) {
          const tmpFile = path.join(os.tmpdir(), `dashplayer-sub-${Date.now()}-${i}.vtt`);
          args.push('-map', `0:s:${i}?`, '-c:s', 'webvtt', '-y', tmpFile);
          subTmpFiles.push(tmpFile);
        }
        console.log(`[FFmpeg] Also extracting ${subCount} subtitle tracks to temp files`);
      }

      ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let headersSent = false;
      let stderrBuf = '';

      ffmpegProcess.stdout.on('data', (chunk) => {
        if (!headersSent) {
          headersSent = true;
          console.log('[FFmpeg] First data received, streaming to browser');
          res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
        }
        try { res.write(chunk); } catch(e) {}
      });

      ffmpegProcess.stderr.on('data', (d) => {
        const msg = d.toString();
        stderrBuf += msg;
        // Log important lines (skip progress/stats)
        const lines = msg.split('\n').filter(l => l.trim() && !l.includes('frame=') && !l.includes('size='));
        lines.forEach(l => { if (l.trim()) console.log('[FFmpeg]', l.trim()); });
      });

      ffmpegProcess.on('exit', (code) => {
        console.log('[FFmpeg] Process exited with code', code);
        if (currentTranscodeResponse === res) currentTranscodeResponse = null;
        if (!headersSent) {
          const errDetail = stderrBuf.slice(-800).trim();
          console.log('[FFmpeg] No output produced! stderr:', errDetail);
          try { res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }); } catch(e) {}
          try { res.end('FFmpeg error: ' + errDetail); } catch(e) {}
        } else {
          try { res.end(); } catch(e) {}
        }
        // Cache any extracted subtitle files
        for (let i = 0; i < subTmpFiles.length; i++) {
          const f = subTmpFiles[i];
          if (fs.existsSync(f) && fs.statSync(f).size > 10) {
            const ck = `${sourceUrl}::${i}`;
            subtitleCache.set(ck, { ready: true, path: f });
            console.log(`[FFmpeg] Subtitle track ${i} cached: ${f} (${fs.statSync(f).size} bytes)`);
          }
        }
        ffmpegProcess = null;
      });

      ffmpegProcess.on('error', (err) => {
        console.log('[FFmpeg] Process error:', err.message);
        if (!headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          res.end('FFmpeg error: ' + err.message);
        } else {
          res.end();
        }
        ffmpegProcess = null;
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
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';
    execFile(ffmpegPath, [
      '-hide_banner',
      '-user_agent', ua,
      '-probesize', '5000000',       // 5MB - just enough for metadata
      '-analyzeduration', '3000000', // 3 seconds
      '-i', url,
    ], { timeout: 8000 }, (err, stdout, stderr) => {
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
ipcMain.handle('ffmpeg-transcode-url', async (event, { url, audioTrack, subtitleCount }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };
  const port = await ensureLocalServer();
  const subs = subtitleCount || 0;
  const transUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&audio=${audioTrack || 0}&mode=transcode&subs=${subs}`;
  console.log('[FFmpeg] Transcode URL:', transUrl, `(subs: ${subs})`);
  return { success: true, url: transUrl };
});

// Extract subtitle - returns pipe URL immediately for streaming
ipcMain.handle('ffmpeg-subtitle-url', async (event, { url, subIndex }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };

  const cacheKey = `${url}::${subIndex || 0}`;

  // Check cache first - if we have a completed extraction, serve from file
  if (subtitleCache.has(cacheKey)) {
    const cached = subtitleCache.get(cacheKey);
    if (cached.ready && cached.path && fs.existsSync(cached.path)) {
      console.log('[FFmpeg sub] Using cached subtitle:', cached.path);
      const port = await ensureLocalServer();
      return { success: true, url: `http://127.0.0.1:${port}/stream?mode=subtitle-file&path=${encodeURIComponent(cached.path)}` };
    }
  }

  // Return the pipe URL immediately - FFmpeg will stream data as it extracts
  const port = await ensureLocalServer();
  const pipeUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&subIndex=${subIndex || 0}&mode=subtitle`;
  console.log(`[FFmpeg sub] Returning pipe URL for subtitle track ${subIndex || 0}`);
  return { success: true, url: pipeUrl };
});

// Stop current FFmpeg process
ipcMain.handle('ffmpeg-stop', () => {
  stopFfmpeg();
  return { success: true };
});

app.whenReady().then(() => {
  ffmpegPath = findBinary('ffmpeg');

  // Log FFmpeg version for debugging
  if (ffmpegPath) {
    try {
      const ver = require('child_process').execFileSync(ffmpegPath, ['-version'], { timeout: 5000, encoding: 'utf8' });
      console.log('[FFmpeg] Version:', ver.split('\n')[0]);
    } catch(e) { console.log('[FFmpeg] Version check failed:', e.message); }
    ensureLocalServer();
  } else {
    console.log('[FFmpeg] WARNING: FFmpeg not found! Transcode features unavailable.');
  }

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
