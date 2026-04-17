const { app, BrowserWindow, session, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');

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
const subtitleCache = new Map(); // url+index -> { path, ready }

// Pending subtitle tracks to embed in next transcode (set by IPC, consumed by server)
let pendingSubtitleTracks = null;
let activeSubtitleFiles = {}; // track index -> temp file path

function findBinary(name) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const bundled = path.join(process.resourcesPath || path.join(__dirname, 'resources'), 'ffmpeg', name + ext);
  if (fs.existsSync(bundled)) {
    console.log(`[FFmpeg] Found bundled ${name}:`, bundled);
    return bundled;
  }
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

// Safe write to HTTP response - prevents ERR_STREAM_WRITE_AFTER_END crashes
function safeWrite(res, chunk) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try { res.write(chunk); return true; } catch(e) { return false; }
}
function safeEnd(res, data) {
  if (!res || res.writableEnded || res.destroyed) return;
  try { if (data) res.end(data); else res.end(); } catch(e) {}
}
function safeWriteHead(res, code, headers) {
  if (!res || res.headersSent || res.writableEnded || res.destroyed) return;
  try { res.writeHead(code, headers); } catch(e) {}
}

let currentTranscodeResponse = null;

function stopFfmpeg() {
  if (ffmpegProcess) {
    const proc = ffmpegProcess;
    const pid = proc.pid;
    console.log('[FFmpeg] Stopping process PID:', pid);
    ffmpegProcess = null;
    try { proc.stdin.write('q\n'); proc.stdin.end(); } catch(e) {}
    // Remove all stdout/stderr listeners to prevent writes after response ends
    try { proc.stdout.removeAllListeners('data'); } catch(e) {}
    setTimeout(() => {
      try {
        if (process.platform === 'win32' && pid) {
          require('child_process').exec(`taskkill /PID ${pid} /T /F`, () => {});
        } else {
          proc.kill('SIGKILL');
        }
      } catch(e) {}
    }, 300);
  }
  if (currentTranscodeResponse) {
    safeEnd(currentTranscodeResponse);
    currentTranscodeResponse = null;
  }
}

function ensureLocalServer() {
  return new Promise((resolve) => {
    if (localServer && localServerPort) { resolve(localServerPort); return; }

    localServer = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost`);
      const sourceUrl = url.searchParams.get('url');
      const audioTrack = url.searchParams.get('audio') || '0';
      const mode = url.searchParams.get('mode') || 'transcode';

      /* ── Radio: audio-only MP3 output ── */
      if (mode === 'radio') {
        console.log(`[FFmpeg] Radio remux:`, sourceUrl);
        stopFfmpeg();
        currentTranscodeResponse = res;

        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';
        ffmpegProcess = spawn(ffmpegPath, [
          '-hide_banner', '-loglevel', 'info',
          '-user_agent', userAgent,
          '-probesize', '500000',
          '-analyzeduration', '1000000',
          '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
          '-i', sourceUrl,
          '-vn',
          '-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '2',
          '-f', 'mp3',
          'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        let headersSent = false;
        const proc = ffmpegProcess;
        proc.stdout.on('data', (chunk) => {
          if (res.writableEnded || res.destroyed) return;
          if (!headersSent) {
            headersSent = true;
            console.log('[FFmpeg] Radio: first data received');
            safeWriteHead(res, 200, { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
          }
          safeWrite(res, chunk);
        });
        proc.stderr.on('data', (d) => {
          const lines = d.toString().split('\n').filter(l => l.trim() && !l.includes('frame=') && !l.includes('size='));
          lines.forEach(l => { if (l.trim()) console.log('[FFmpeg radio]', l.trim()); });
        });
        proc.on('exit', (code) => {
          console.log('[FFmpeg] Radio exited code', code);
          if (currentTranscodeResponse === res) currentTranscodeResponse = null;
          if (!headersSent) {
            safeWriteHead(res, 500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            safeEnd(res, 'Radio stream error');
          } else {
            safeEnd(res);
          }
          if (ffmpegProcess === proc) ffmpegProcess = null;
        });
        proc.on('error', (err) => {
          console.log('[FFmpeg] Radio error:', err.message);
          if (!headersSent) safeWriteHead(res, 500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          safeEnd(res, err.message);
          if (ffmpegProcess === proc) ffmpegProcess = null;
        });
        req.on('close', () => { console.log('[FFmpeg] Radio client disconnected'); stopFfmpeg(); });
        return;
      }

      /* ── Serve cached subtitle file ── */
      if (mode === 'subtitle-file') {
        const filePath = url.searchParams.get('path');
        if (!filePath || !fs.existsSync(filePath)) {
          safeWriteHead(res, 404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          safeEnd(res, 'Subtitle file not found');
          return;
        }
        console.log('[FFmpeg sub] Serving subtitle file:', filePath);
        const data = fs.readFileSync(filePath);
        safeWriteHead(res, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Content-Length': data.length });
        safeEnd(res, data);
        return;
      }

      if (!sourceUrl) { safeWriteHead(res, 400); safeEnd(res, 'Missing url'); return; }

      /* ── Subtitle extraction via pipe ── */
      if (mode === 'subtitle') {
        const subIndex = url.searchParams.get('subIndex') || '0';
        const cacheKey = `${sourceUrl}::${subIndex}`;
        console.log(`[FFmpeg] Extracting subtitle track ${subIndex} from:`, sourceUrl);
        const subUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';
        const proc = spawn(ffmpegPath, [
          '-hide_banner', '-loglevel', 'info',
          '-user_agent', subUa,
          '-probesize', '100000000',
          '-analyzeduration', '30000000',
          '-i', sourceUrl,
          '-map', `0:s:${subIndex}`,
          '-an', '-vn',
          '-c:s', 'webvtt',
          '-f', 'webvtt',
          'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        const subTimeout = setTimeout(() => {
          if (!hasData) {
            console.log('[FFmpeg sub] Timeout - no data after 120s');
            try { proc.kill(); } catch(e) {}
          }
        }, 120000);

        let hasData = false;
        let stderrLog = '';
        let allData = [];
        proc.stdout.on('data', (chunk) => {
          if (res.writableEnded || res.destroyed) return;
          if (!hasData) {
            hasData = true;
            console.log('[FFmpeg sub] First subtitle data received');
            safeWriteHead(res, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          }
          allData.push(chunk);
          safeWrite(res, chunk);
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
            console.log('[FFmpeg sub] No data produced. Code:', code, 'stderr:', stderrLog.slice(-500));
            safeWriteHead(res, 200, { 'Content-Type': 'text/vtt', 'Access-Control-Allow-Origin': '*' });
            safeEnd(res, 'WEBVTT\n\n');
          } else {
            const tmpFile = path.join(os.tmpdir(), `dashplayer-sub-${Date.now()}-${subIndex}.vtt`);
            try {
              fs.writeFileSync(tmpFile, Buffer.concat(allData));
              subtitleCache.set(cacheKey, { ready: true, path: tmpFile });
              console.log('[FFmpeg sub] Cached to:', tmpFile, '(' + Buffer.concat(allData).length + ' bytes)');
            } catch(e) { console.log('[FFmpeg sub] Cache error:', e.message); }
            safeEnd(res);
          }
        });
        proc.on('error', (e) => {
          console.log('[FFmpeg sub] Error:', e.message);
          safeWriteHead(res, 500, { 'Access-Control-Allow-Origin': '*' });
          safeEnd(res);
        });
        req.on('close', () => { try { proc.kill(); } catch(e) {} });
        return;
      }

      /* ── Main transcode/remux mode ── */
      console.log(`[FFmpeg] Remuxing:`, sourceUrl);
      stopFfmpeg();
      currentTranscodeResponse = res;

      const isLive = sourceUrl.includes('/live/') || sourceUrl.includes('/timeshift/');
      const seekTime = parseFloat(url.searchParams.get('seek') || '0');

      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';

      // Dual seek for VOD: input seek to (time-15s) for speed, output seek 15s for accuracy
      // This prevents audio/video desync when switching audio tracks
      let inputSeekArgs = [];
      let outputSeekArgs = [];
      if (!isLive && seekTime > 0) {
        if (seekTime > 20) {
          // Dual seek: fast input seek + precise output seek
          const inputSeek = Math.max(0, seekTime - 15);
          inputSeekArgs = ['-ss', String(inputSeek)];
          outputSeekArgs = ['-ss', String(seekTime - inputSeek)];
        } else {
          // Short seek: just input seek is fine
          inputSeekArgs = ['-ss', String(seekTime)];
        }
      }

      // Build reconnect args for live streams (placed before -i, after other input options)
      const reconnectArgs = isLive
        ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '3']
        : [];

      const args = [
        '-hide_banner', '-loglevel', 'info',
        '-user_agent', userAgent,
        ...inputSeekArgs,
        '-probesize', isLive ? '1000000' : '5000000',
        '-analyzeduration', isLive ? '1000000' : '5000000',
        ...reconnectArgs,
        '-i', sourceUrl,
        ...outputSeekArgs,
        '-map', '0:v:0?',
        '-map', `0:a:${audioTrack}?`,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-async', '1',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1',
      ];

      // If subtitle tracks were requested, add them as additional file outputs
      if (pendingSubtitleTracks && pendingSubtitleTracks.length > 0 && !isLive) {
        console.log('[FFmpeg] Including subtitle extraction for tracks:', pendingSubtitleTracks);
        for (const st of pendingSubtitleTracks) {
          const tmpFile = path.join(os.tmpdir(), `dashplayer-sub-${Date.now()}-${st}.vtt`);
          args.push('-map', `0:s:${st}?`, '-c:s', 'webvtt', tmpFile);
          activeSubtitleFiles[st] = tmpFile;
          // Also cache it
          const cacheKey = `${sourceUrl}::${st}`;
          subtitleCache.set(cacheKey, { ready: false, path: tmpFile });
        }
        pendingSubtitleTracks = null;
      }

      console.log('[FFmpeg] Command args:', args.filter(a => !a.includes('Mozilla')).join(' '));

      ffmpegProcess = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      let headersSent = false;
      let stderrBuf = '';
      const proc = ffmpegProcess;

      proc.stdout.on('data', (chunk) => {
        if (res.writableEnded || res.destroyed) return;
        if (!headersSent) {
          headersSent = true;
          console.log('[FFmpeg] First data received, streaming to browser');
          safeWriteHead(res, 200, {
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
        }
        safeWrite(res, chunk);
      });

      proc.stderr.on('data', (d) => {
        const msg = d.toString();
        stderrBuf += msg;
        const lines = msg.split('\n').filter(l => l.trim() && !l.includes('frame=') && !l.includes('size='));
        lines.forEach(l => { if (l.trim()) console.log('[FFmpeg]', l.trim()); });
      });

      proc.on('exit', (code) => {
        console.log('[FFmpeg] Process exited code', code);
        if (currentTranscodeResponse === res) currentTranscodeResponse = null;
        // Mark any subtitle files as ready
        for (const [idx, tmpFile] of Object.entries(activeSubtitleFiles)) {
          if (fs.existsSync(tmpFile)) {
            const size = fs.statSync(tmpFile).size;
            console.log(`[FFmpeg] Subtitle file ${idx}: ${tmpFile} (${size} bytes)`);
            // Find and update cache
            for (const [key, val] of subtitleCache.entries()) {
              if (val.path === tmpFile) { val.ready = true; break; }
            }
          }
        }
        if (!headersSent) {
          const errDetail = stderrBuf.slice(-800).trim();
          console.log('[FFmpeg] No output! stderr:', errDetail);
          safeWriteHead(res, 500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
          safeEnd(res, 'FFmpeg error: ' + errDetail);
        } else {
          safeEnd(res);
        }
        if (ffmpegProcess === proc) ffmpegProcess = null;
      });

      proc.on('error', (err) => {
        console.log('[FFmpeg] Process error:', err.message);
        if (!headersSent) {
          safeWriteHead(res, 500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        }
        safeEnd(res, 'FFmpeg error: ' + err.message);
        if (ffmpegProcess === proc) ffmpegProcess = null;
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

ipcMain.handle('ffmpeg-status', () => ({
  available: !!ffmpegPath,
  ffmpegPath,
  port: localServerPort,
}));

// Probe media file
ipcMain.handle('ffmpeg-probe', async (event, { url }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };

  return new Promise((resolve) => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dash-player/1.0.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36';
    execFile(ffmpegPath, [
      '-hide_banner',
      '-user_agent', ua,
      '-probesize', '5000000',
      '-analyzeduration', '3000000',
      '-i', url,
    ], { timeout: 8000 }, (err, stdout, stderr) => {
      const output = stderr || '';
      if (!output) { resolve({ success: false, error: 'No output' }); return; }
      try {
        const audio = [];
        const subtitle = [];
        let audioIdx = 0, subIdx = 0;
        const lines = output.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const audioMatch = line.match(/Stream #\d+:(\d+)(?:\((\w+)\))?.*?Audio:\s*(\w+)/);
          const subMatch = line.match(/Stream #\d+:(\d+)(?:\((\w+)\))?.*?Subtitle:\s*(\w+)/);

          if (audioMatch) {
            let title = '';
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              const tm = lines[j].match(/^\s+title\s*:\s*(.+)$/i);
              if (tm) { title = tm[1].trim(); break; }
              if (lines[j].match(/Stream #/)) break;
            }
            audio.push({ index: audioIdx++, streamIndex: parseInt(audioMatch[1]), codec: audioMatch[3], lang: audioMatch[2] || '', title });
          }
          if (subMatch) {
            let title = '';
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              const tm = lines[j].match(/^\s+title\s*:\s*(.+)$/i);
              if (tm) { title = tm[1].trim(); break; }
              if (lines[j].match(/Stream #/)) break;
            }
            subtitle.push({ index: subIdx++, streamIndex: parseInt(subMatch[1]), codec: subMatch[3], lang: subMatch[2] || '', title });
          }
        }
        console.log(`[FFmpeg probe] Found ${audio.length} audio, ${subtitle.length} subtitle tracks`);
        resolve({ success: true, audio, subtitle });
      } catch (e) {
        resolve({ success: false, error: 'Parse error: ' + e.message });
      }
    });
  });
});

// Get local remux URL
ipcMain.handle('ffmpeg-transcode-url', async (event, { url, audioTrack, seek, subtitleTracks }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };

  // Store subtitle tracks for the next server request to include
  if (subtitleTracks && subtitleTracks.length > 0) {
    pendingSubtitleTracks = subtitleTracks;
    activeSubtitleFiles = {};
  }

  const port = await ensureLocalServer();
  const audioParam = audioTrack ? `&audio=${audioTrack}` : '';
  const seekParam = seek ? `&seek=${seek}` : '';
  const transUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&mode=transcode${audioParam}${seekParam}`;
  console.log('[FFmpeg] Remux URL:', transUrl);
  return { success: true, url: transUrl };
});

// Extract subtitle - returns pipe URL
ipcMain.handle('ffmpeg-subtitle-url', async (event, { url, subIndex }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };

  const cacheKey = `${url}::${subIndex || 0}`;

  // Check cache first
  if (subtitleCache.has(cacheKey)) {
    const cached = subtitleCache.get(cacheKey);
    if (cached.path && fs.existsSync(cached.path)) {
      const size = fs.statSync(cached.path).size;
      if (size > 10) { // More than just "WEBVTT\n\n"
        console.log('[FFmpeg sub] Using cached subtitle:', cached.path, '(' + size + ' bytes)');
        const port = await ensureLocalServer();
        return { success: true, url: `http://127.0.0.1:${port}/stream?mode=subtitle-file&path=${encodeURIComponent(cached.path)}` };
      }
    }
  }

  // Also check activeSubtitleFiles (from multi-output transcode)
  if (activeSubtitleFiles[subIndex || 0]) {
    const filePath = activeSubtitleFiles[subIndex || 0];
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size > 10) {
        console.log('[FFmpeg sub] Using active subtitle file:', filePath, '(' + size + ' bytes)');
        const port = await ensureLocalServer();
        return { success: true, url: `http://127.0.0.1:${port}/stream?mode=subtitle-file&path=${encodeURIComponent(filePath)}` };
      }
    }
  }

  // Pipe extraction
  const port = await ensureLocalServer();
  const pipeUrl = `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&subIndex=${subIndex || 0}&mode=subtitle`;
  return { success: true, url: pipeUrl };
});

// Radio URL (audio-only)
ipcMain.handle('ffmpeg-radio-url', async (event, { url }) => {
  if (!ffmpegPath) return { success: false, error: 'FFmpeg not available' };
  const port = await ensureLocalServer();
  return { success: true, url: `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(url)}&mode=radio` };
});

// Stop FFmpeg
ipcMain.handle('ffmpeg-stop', () => {
  stopFfmpeg();
  return { success: true };
});

app.whenReady().then(() => {
  ffmpegPath = findBinary('ffmpeg');
  if (ffmpegPath) {
    try {
      const ver = require('child_process').execFileSync(ffmpegPath, ['-version'], { timeout: 5000, encoding: 'utf8' });
      console.log('[FFmpeg] Version:', ver.split('\n')[0]);
    } catch(e) {}
    ensureLocalServer();
  } else {
    console.log('[FFmpeg] WARNING: FFmpeg not found!');
  }

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  stopFfmpeg();
  if (localServer) { try { localServer.close(); } catch(e) {} }
  if (process.platform !== 'darwin') app.quit();
});

app.setAppUserModelId('tv.dashplayer.app');
