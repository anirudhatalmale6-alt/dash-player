import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { mockData } from './services/xtreamApi';
import axios from 'axios';
import mpegts from 'mpegts.js';
import Hls from 'hls.js';
import './styles.css';

/* ── Favorites helper (persisted in localStorage) ── */
function getFavorites(type) {
  try { return JSON.parse(localStorage.getItem(`dash_fav_${type}`) || '[]'); } catch { return []; }
}
function setFavorites(type, items) {
  localStorage.setItem(`dash_fav_${type}`, JSON.stringify(items));
}
function toggleFavorite(type, id) {
  const favs = getFavorites(type);
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(id);
  setFavorites(type, favs);
  return favs;
}
function isFavorite(type, id) {
  return getFavorites(type).includes(id);
}

/* ── Watch history helper ── */
function getWatchHistory() {
  try { return JSON.parse(localStorage.getItem('dash_history') || '[]'); } catch { return []; }
}
function addToHistory(item) {
  const hist = getWatchHistory().filter(h => h.id !== item.id);
  hist.unshift({ ...item, watchedAt: Date.now() });
  if (hist.length > 50) hist.length = 50; // keep last 50
  localStorage.setItem('dash_history', JSON.stringify(hist));
}

/* ── Xtream API helper ── */
function createXtreamApi(url, username, password) {
  const baseUrl = url.replace(/\/$/, '');
  const req = async (action, params = {}) => {
    try {
      const res = await axios.get(`${baseUrl}/player_api.php`, {
        params: { username, password, action, ...params },
        headers: { 'User-Agent': 'DashPlayer/1.0' },
        timeout: 60000,
      });
      return res.data;
    } catch (e) {
      console.warn('Xtream API error:', e.message);
      return null;
    }
  };
  return {
    authenticate: () => req(),
    getLiveCategories: () => req('get_live_categories'),
    getLiveStreams: (catId) => req('get_live_streams', catId ? { category_id: catId } : {}),
    getVodCategories: () => req('get_vod_categories'),
    getVodStreams: (catId) => req('get_vod_streams', catId ? { category_id: catId } : {}),
    getSeriesCategories: () => req('get_series_categories'),
    getSeries: (catId) => req('get_series', catId ? { category_id: catId } : {}),
    getSeriesInfo: (seriesId) => req('get_series_info', { series_id: seriesId }),
    getVodInfo: (vodId) => req('get_vod_info', { vod_id: vodId }),
    getEPG: (streamId) => req('get_short_epg', { stream_id: streamId }),
    getLiveUrl: (streamId, ext = 'ts') => `${baseUrl}/live/${username}/${password}/${streamId}.${ext}`,
    getVodUrl: (streamId, ext = 'mp4') => `${baseUrl}/movie/${username}/${password}/${streamId}.${ext}`,
    getSeriesUrl: (streamId, ext = 'mp4') => `${baseUrl}/series/${username}/${password}/${streamId}.${ext}`,
  };
}

/* ── Generate a persistent device identity ── */
function getDeviceIdentity() {
  let stored = localStorage.getItem('dash_device');
  if (stored) return JSON.parse(stored);
  // Generate MAC-like address and device key
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  const mac = `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
  const key = Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
  const device = { mac, key };
  localStorage.setItem('dash_device', JSON.stringify(device));
  return device;
}

/* ── ACTIVATION SCREEN (First screen after install) ── */
function ActivationScreen({ onActivated }) {
  const [device] = useState(() => getDeviceIdentity());
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showQuickConnect, setShowQuickConnect] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectError, setConnectError] = useState('');
  const [m3uInput, setM3uInput] = useState('');
  const panelUrl = 'https://panel.dashplayer.tv';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Parse M3U URL to extract server, username, password
  const parseM3uUrl = (url) => {
    try {
      const u = new URL(url);
      const params = u.searchParams;
      const user = params.get('username');
      const pass = params.get('password');
      if (user && pass) {
        const base = `${u.protocol}//${u.host}`;
        return { url: base, username: user, password: pass };
      }
    } catch (e) {}
    return null;
  };

  const handleM3uPaste = (val) => {
    setM3uInput(val);
    const parsed = parseM3uUrl(val.trim());
    if (parsed) {
      setServerUrl(parsed.url);
      setUsername(parsed.username);
      setPassword(parsed.password);
      setConnectError('');
    }
  };

  const handleQuickConnect = async () => {
    if (!serverUrl || !username || !password) {
      setConnectError('Please fill in all fields or paste an M3U URL');
      return;
    }
    setChecking(true);
    setConnectError('');
    try {
      const api = createXtreamApi(serverUrl, username, password);
      const data = await api.authenticate();
      if (data && data.user_info) {
        onActivated({ url: serverUrl, username, password });
      } else {
        setConnectError('Could not authenticate. Check your credentials.');
      }
    } catch (e) {
      setConnectError('Connection failed: ' + e.message);
    }
    setChecking(false);
  };

  const handleReload = () => {
    setChecking(true);
    // In production: calls admin panel API to check if device is activated
    // POST /api/player/device/auth { mac_address, device_key }
    // For demo: simulate activation after 1s
    setTimeout(() => {
      setChecking(false);
      onActivated({ url: 'http://demo', username: 'demo', password: 'demo' });
    }, 1500);
  };

  // Generate QR code as SVG (simple version - in production use a proper QR library)
  const qrSize = 140;

  return (
    <div className="activation-screen">
      <div className="activation-container">
        {/* Left - Device Info */}
        <div className="activation-info">
          <div className="activation-info-inner">
            <p className="activation-instruction">
              To add/manage playlists, use the following<br />values on the admin panel:
            </p>

            <a href={panelUrl} className="activation-url">{panelUrl}</a>

            <div className="activation-field">
              <label className="activation-label">Mac Address</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.mac}</span>
                <button className="activation-copy" onClick={() => copyToClipboard(device.mac, 'mac')}>
                  {copied === 'mac' ? '✓' : '⧉'}
                </button>
              </div>
            </div>

            <div className="activation-field">
              <label className="activation-label">Device Key</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.key}</span>
                <button className="activation-copy" onClick={() => copyToClipboard(device.key, 'key')}>
                  {copied === 'key' ? '✓' : '⧉'}
                </button>
              </div>
            </div>

            <div className="activation-buttons">
              <button className="activation-btn activation-btn-reload" onClick={handleReload} disabled={checking}>
                {checking ? 'Checking...' : 'RELOAD'}
              </button>
              <button className="activation-btn activation-btn-reload" onClick={() => setShowQuickConnect(!showQuickConnect)}>
                {showQuickConnect ? 'HIDE' : 'ADD PLAYLIST'}
              </button>
            </div>

            {showQuickConnect && (
              <div className="quick-connect-section">
                <div className="activation-field">
                  <label className="activation-label">Paste M3U URL or Xtream Login</label>
                  <input
                    className="quick-connect-input"
                    placeholder="http://server:port/get.php?username=...&password=..."
                    value={m3uInput}
                    onChange={e => handleM3uPaste(e.target.value)}
                  />
                </div>
                <div className="quick-connect-fields">
                  <div className="activation-field">
                    <label className="activation-label">Server URL</label>
                    <input className="quick-connect-input" placeholder="http://server:port" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
                  </div>
                  <div className="quick-connect-row">
                    <div className="activation-field" style={{flex: 1}}>
                      <label className="activation-label">Username</label>
                      <input className="quick-connect-input" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div className="activation-field" style={{flex: 1}}>
                      <label className="activation-label">Password</label>
                      <input className="quick-connect-input" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  </div>
                </div>
                <button className="activation-btn activation-btn-reload" onClick={handleQuickConnect} disabled={checking} style={{marginTop: 8, width: '100%'}}>
                  {checking ? 'Connecting...' : 'CONNECT'}
                </button>
                {connectError && <p style={{color: '#ef4444', fontSize: 12, marginTop: 6}}>{connectError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right - Branding & QR */}
        <div className="activation-brand">
          <div className="activation-logo">D</div>
          <div className="activation-app-name">Dash Player</div>
          <div className="activation-qr">
            <div className="activation-qr-placeholder">
              <svg width={qrSize} height={qrSize} viewBox="0 0 140 140">
                <rect width="140" height="140" rx="12" fill="white"/>
                {/* Simplified QR pattern */}
                <rect x="12" y="12" width="36" height="36" rx="4" fill="#7c3aed"/>
                <rect x="18" y="18" width="24" height="24" rx="2" fill="white"/>
                <rect x="24" y="24" width="12" height="12" rx="1" fill="#7c3aed"/>
                <rect x="92" y="12" width="36" height="36" rx="4" fill="#7c3aed"/>
                <rect x="98" y="18" width="24" height="24" rx="2" fill="white"/>
                <rect x="104" y="24" width="12" height="12" rx="1" fill="#7c3aed"/>
                <rect x="12" y="92" width="36" height="36" rx="4" fill="#7c3aed"/>
                <rect x="18" y="98" width="24" height="24" rx="2" fill="white"/>
                <rect x="24" y="104" width="12" height="12" rx="1" fill="#7c3aed"/>
                {/* Center data pattern */}
                <rect x="56" y="12" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="72" y="12" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="28" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="12" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="28" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="72" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="88" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="72" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="120" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="72" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="88" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="104" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="88" y="104" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="104" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="120" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="120" y="104" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="72" y="120" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="104" y="120" width="8" height="8" rx="1" fill="#7c3aed"/>
                {/* Center logo */}
                <rect x="52" y="52" width="16" height="16" rx="4" fill="#7c3aed"/>
                <text x="60" y="64" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">D</text>
              </svg>
            </div>
          </div>
          <p className="activation-qr-text">Scan QR to add playlist</p>
        </div>
      </div>
    </div>
  );
}

/* ── HOME SCREEN ── */
function HomeScreen({ onNavigate, credentials, playerLicense }) {
  const [time, setTime] = useState(new Date());
  const [device] = useState(() => getDeviceIdentity());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="home-screen">
      {/* Top Bar */}
      <div className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-logo">D</div>
          <span className="home-brand-name">Dash Player</span>
        </div>
        <div className="home-clock">
          <div className="home-clock-time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="home-clock-date">{formatDate(time)}</div>
        </div>
        <div className="home-topbar-actions">
          <button className="home-search-btn" onClick={() => onNavigate('search')}>&#128269; Search</button>
        </div>
      </div>

      {/* Main Cards */}
      <div className="home-content">
        <div className="home-cards-main">
          <div className="home-card home-card-live" onClick={() => onNavigate('live')}>
            <div className="home-card-icon">&#128250;</div>
            <div className="home-card-label">Live TV</div>
          </div>
          <div className="home-card home-card-movies" onClick={() => onNavigate('vod')}>
            <div className="home-card-icon">&#127910;</div>
            <div className="home-card-label">Movies</div>
          </div>
          <div className="home-card home-card-series" onClick={() => onNavigate('series')}>
            <div className="home-card-icon">&#127916;</div>
            <div className="home-card-label">Series</div>
          </div>
          <div className="home-card home-card-radio" onClick={() => onNavigate('radio')}>
            <div className="home-card-icon">&#127911;</div>
            <div className="home-card-label">Radio</div>
          </div>
        </div>

        {/* Secondary Cards */}
        <div className="home-cards-secondary">
          <div className="home-card-sm" onClick={() => onNavigate('catchup')}>
            <span className="home-card-sm-icon">&#9202;</span>
            <span>Catch Up</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('favorites')}>
            <span className="home-card-sm-icon">&#9733;</span>
            <span>Favorites</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('epg')}>
            <span className="home-card-sm-icon">&#128203;</span>
            <span>TV Guide</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('settings')}>
            <span className="home-card-sm-icon">&#9881;</span>
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="home-bottombar">
        <div className="home-playlist-info">
          MAC: <strong>{device.mac}</strong>
        </div>
        <div className="home-version">{playerLicense.type === 'trial' ? 'Player Trial: ' : 'Player Activated: '}<strong>{getPlayerStatusText(playerLicense)}</strong></div>
      </div>
    </div>
  );
}

/* ── Base64 to UTF-8 decoder (handles Turkish/special chars) ── */
function b64decode(str) {
  try {
    return decodeURIComponent(atob(str).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
  } catch (e) {
    try { return atob(str); } catch (e2) { return str; }
  }
}

/* ── VIDEO PLAYER COMPONENT ── */
function VideoPlayer({ url, onClose, title, inline }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const retryTimerRef = useRef(null);
  const stallTimerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [currentFormat, setCurrentFormat] = useState('');
  const mountedRef = useRef(true);
  const MAX_RETRIES = 3;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (stallTimerRef.current) { clearInterval(stallTimerRef.current); stallTimerRef.current = null; }
    if (playerRef.current) {
      try { playerRef.current.pause(); } catch(e) {}
      try { playerRef.current.unload(); } catch(e) {}
      try { playerRef.current.detachMediaElement(); } catch(e) {}
      try { playerRef.current.destroy(); } catch(e) {}
      playerRef.current = null;
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch(e) {}
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!url || !videoRef.current) return;
    setError(null);
    setLoading(true);
    setRetryCount(0);
    cleanup();
    const video = videoRef.current;

    const isLive = url.includes('/live/');
    const isSeries = url.includes('/series/');
    const baseUrl = url.replace(/\.\w+$/, '');

    // Stall detection: if video stops progressing for 10s, attempt recovery
    const setupStallDetection = () => {
      if (stallTimerRef.current) clearInterval(stallTimerRef.current);
      let lastTime = 0;
      let stallCount = 0;
      stallTimerRef.current = setInterval(() => {
        if (!video || video.paused || video.ended) return;
        if (video.currentTime === lastTime && video.readyState < 3) {
          stallCount++;
          if (stallCount >= 3) { // 3 checks * 3s = ~9s stalled
            stallCount = 0;
            console.log('Stream stall detected, attempting recovery...');
            // For mpegts, try seeking slightly ahead
            if (playerRef.current && isLive) {
              try {
                const buffered = video.buffered;
                if (buffered.length > 0) {
                  video.currentTime = buffered.end(buffered.length - 1) - 0.5;
                }
              } catch(e) {}
            }
          }
        } else {
          stallCount = 0;
        }
        lastTime = video.currentTime;
      }, 3000);
    };

    const onPlaying = () => {
      if (!mountedRef.current) return;
      setLoading(false);
      setError(null);
      setupStallDetection();
    };

    const tryMpegTs = (streamUrl) => {
      if (!mpegts.isSupported()) return tryHls();
      if (!mountedRef.current) return;
      setCurrentFormat('MPEG-TS');
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: isLive,
        url: streamUrl,
      }, {
        enableWorker: true,
        lazyLoadMaxDuration: isLive ? 60 : 300,
        liveBufferLatencyChasing: isLive,
        liveBufferLatencyMaxLatency: isLive ? 8 : 60,
        liveBufferLatencyMinRemain: isLive ? 2 : 5,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
        seekType: 'range',
        fixAudioTimestampGap: true,
      });
      playerRef.current = player;
      player.attachMediaElement(video);
      player.load();

      let errorTriggered = false;
      player.on(mpegts.Events.ERROR, (type, detail) => {
        console.warn('mpegts error:', type, detail);
        if (errorTriggered) return;
        errorTriggered = true;
        cleanup();
        tryHls();
      });

      // Handle media info for better debugging
      player.on(mpegts.Events.MEDIA_INFO, () => {
        console.log('mpegts: media info received');
      });

      video.addEventListener('canplay', onPlaying, { once: true });
      video.addEventListener('playing', onPlaying, { once: true });

      // Wait a bit then play to allow buffer to fill
      setTimeout(() => {
        if (mountedRef.current && video) {
          video.play().catch(() => {});
        }
      }, 300);

      // Timeout: if no data in 10s, try next format
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (video.readyState < 2 && !errorTriggered) {
          console.log('mpegts timeout, falling back to HLS');
          errorTriggered = true;
          cleanup();
          tryHls();
        }
      }, 10000);
    };

    const tryHls = () => {
      if (!Hls.isSupported()) return tryDirect();
      if (!mountedRef.current) return;
      setCurrentFormat('HLS');
      const hlsUrl = baseUrl + '.m3u8';
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: isLive ? 10 : 60,
        maxMaxBufferLength: isLive ? 30 : 300,
        startLevel: -1,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4,
        levelLoadingTimeOut: 15000,
        manifestLoadingTimeOut: 15000,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!mountedRef.current) return;
        setLoading(false);
        video.play().catch(() => {});
        setupStallDetection();
      });
      let hlsErrorTriggered = false;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal && !hlsErrorTriggered) {
          hlsErrorTriggered = true;
          console.warn('HLS fatal error, trying direct');
          cleanup();
          tryDirect();
        }
      });
      // HLS timeout
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (video.readyState < 2 && !hlsErrorTriggered) {
          hlsErrorTriggered = true;
          cleanup();
          tryDirect();
        }
      }, 12000);
    };

    const tryDirect = () => {
      if (!mountedRef.current) return;
      setCurrentFormat('Direct');
      video.src = url;
      video.addEventListener('canplay', onPlaying, { once: true });
      video.addEventListener('playing', onPlaying, { once: true });
      video.addEventListener('error', () => {
        if (!mountedRef.current) return;
        setError('Stream unavailable - try another channel');
        setLoading(false);
      }, { once: true });
      video.play().catch(() => {});
    };

    if (isLive) {
      // Live: mpegts(.ts) -> HLS(.m3u8) -> direct
      tryMpegTs(baseUrl + '.ts');
    } else {
      // VOD/Series: try direct(mp4) first, then mpegts(.ts), then HLS(.m3u8)
      setCurrentFormat('Direct');
      video.src = url;
      video.addEventListener('canplay', onPlaying, { once: true });
      video.addEventListener('playing', onPlaying, { once: true });
      let vodErrorTriggered = false;
      video.addEventListener('error', () => {
        if (vodErrorTriggered || !mountedRef.current) return;
        vodErrorTriggered = true;
        console.log('Direct VOD failed, trying mpegts');
        // Try mpegts for .ts container
        tryMpegTs(baseUrl + '.ts');
      }, { once: true });
      video.play().catch(() => {});
      // VOD timeout
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (video.readyState < 2 && !vodErrorTriggered) {
          vodErrorTriggered = true;
          tryMpegTs(baseUrl + '.ts');
        }
      }, 10000);
    }

    return () => {
      cleanup();
      if (video) video.src = '';
    };
  }, [url]);

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
  };

  if (inline) {
    return (
      <div className="inline-player">
        {loading && !error && <div className="inline-player-loading">Connecting{currentFormat ? ` (${currentFormat})` : ''}...</div>}
        {error && <div className="inline-player-error">{error}</div>}
        <video ref={videoRef} className="inline-video-element" controls autoPlay playsInline />
        {!loading && !error && (
          <div className="inline-player-controls">
            <button className="fullscreen-btn" onClick={handleFullscreen} title="Fullscreen">&#x26F6;</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="video-player-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="video-player-container">
        <div className="video-player-header">
          <span className="video-title">{title || 'Playing'}</span>
          <div className="video-header-actions">
            <button className="video-fullscreen-btn" onClick={handleFullscreen} title="Fullscreen">&#x26F6;</button>
            <button className="video-close-btn" onClick={onClose}>&#10005;</button>
          </div>
        </div>
        {loading && !error && <div className="video-loading">Connecting{currentFormat ? ` (${currentFormat})` : ''}...</div>}
        {error && <div className="video-error">{error}</div>}
        <video ref={videoRef} className="video-element" controls autoPlay playsInline />
      </div>
    </div>
  );
}

/* ── LIVE TV SCREEN ── */
function LiveTVScreen({ onBack, api }) {
  const [categories, setCategories] = useState([{ category_id: 'all', category_name: 'All Channels' }]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [playingChannel, setPlayingChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [epgData, setEpgData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(false);
  const [favs, setFavs] = useState(() => getFavorites('live'));
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('default'); // default, name, num

  // Load categories on mount
  useEffect(() => {
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      if (api) {
        const cats = await api.getLiveCategories();
        if (!cancelled && cats && Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
          setSelectedCategory(cats[0].category_id); // select first category
        } else if (!cancelled) {
          setCategories(mockData.categories);
          setSelectedCategory(mockData.categories[0]?.category_id);
        }
      } else {
        setCategories(mockData.categories);
        setSelectedCategory('all');
        setChannels(mockData.channels);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api]);

  // Load channels when category changes
  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchStreams = async () => {
      setChannelLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) {
        setChannels(streams);
      }
      if (!cancelled) setChannelLoading(false);
    };
    fetchStreams();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  const filtered = useMemo(() => {
    let list = channels.filter(ch => {
      const matchSearch = !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFav = !showFavsOnly || favs.includes(ch.stream_id);
      return matchSearch && matchFav;
    });
    if (sortBy === 'name') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'num') list = [...list].sort((a, b) => (a.num || a.stream_id) - (b.num || b.stream_id));
    return list;
  }, [channels, searchQuery, showFavsOnly, favs, sortBy]);

  const handleToggleFav = (e, streamId) => {
    e.stopPropagation();
    setFavs(toggleFavorite('live', streamId));
  };

  useEffect(() => {
    if (selectedChannel) {
      if (api) {
        api.getEPG(selectedChannel.stream_id).then(data => {
          if (data && data.epg_listings && data.epg_listings.length > 0) {
            setEpgData(data.epg_listings.map((e, i) => ({
              id: e.id || i,
              title: e.title ? b64decode(e.title) : 'No Title',
              description: e.description ? b64decode(e.description) : '',
              start: e.start,
              end: e.end,
            })));
          } else {
            setEpgData(mockData.generateEPG(selectedChannel.num || selectedChannel.stream_id));
          }
        });
      } else {
        setEpgData(mockData.generateEPG(selectedChannel.num || selectedChannel.stream_id));
      }
    }
  }, [selectedChannel, api]);

  const getCurrentProgram = () => null; // Skip mock EPG lookup for real data (too slow with 19K channels)

  const isCurrentProgram = (p) => { const n = new Date(); return new Date(p.start) <= n && new Date(p.end) > n; };
  const isPastProgram = (p) => new Date(p.end) < new Date();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const getProgress = (p) => { const n = new Date(); return Math.min(100, Math.max(0, ((n - new Date(p.start)) / (new Date(p.end) - new Date(p.start))) * 100)); };

  return (
    <div className="section-screen">
      {/* Header */}
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Live TV</h1>
        <div className="section-header-right">
          <button className={`header-filter-btn ${showFavsOnly ? 'active' : ''}`} onClick={() => setShowFavsOnly(!showFavsOnly)} title="Favorites only">&#9733;</button>
          <select className="header-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="default">Default</option>
            <option value="name">A-Z</option>
            <option value="num">By Number</option>
          </select>
          <span className="channel-count">{filtered.length} channels</span>
        </div>
      </div>

      <div className="section-body">
        {/* Sidebar */}
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder="Search channels..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div
                key={cat.category_id}
                className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}
              >
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Channel List */}
        <div className="section-channel-list">
          {(loading || channelLoading) && <div className="loading-indicator">Loading channels...</div>}
          {!loading && !channelLoading && filtered.map(ch => (
              <div
                key={ch.stream_id}
                className={`ch-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedChannel(ch); setPlayingChannel(ch);
                  addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon });
                }}
              >
                <span className="ch-num">{ch.num || ch.stream_id}</span>
                {ch.stream_icon ? (
                  <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => { e.target.style.display = 'none'; if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <div className="ch-icon" style={ch.stream_icon ? { display: 'none' } : {}}>{(ch.name || '?').charAt(0)}</div>
                <div className="ch-info">
                  <div className="ch-name">{ch.name}</div>
                  <div className="ch-prog">{ch.epg_channel_id || ''}</div>
                </div>
                <button className={`ch-fav-btn ${favs.includes(ch.stream_id) ? 'active' : ''}`} onClick={(e) => handleToggleFav(e, ch.stream_id)} title="Favorite">&#9733;</button>
                <button className="ch-play-btn" onClick={(e) => { e.stopPropagation(); setSelectedChannel(ch); setPlayingChannel(ch); }} title="Play">&#9654;</button>
                {selectedChannel?.stream_id === ch.stream_id && <div className="ch-live-dot" />}
              </div>
          ))}
        </div>

        {/* EPG + Inline Player */}
        <div className="section-epg">
          {selectedChannel ? (
            <>
              <div className="epg-top">
                <div>
                  <div className="epg-ch-name">{selectedChannel.name}</div>
                  <div className="epg-ch-cat">{selectedChannel.category_name}</div>
                </div>
                {!playingChannel && (
                  <button className="epg-play-btn" onClick={() => setPlayingChannel(selectedChannel)}>&#9654; Play</button>
                )}
                {playingChannel && (
                  <button className="epg-play-btn" onClick={() => setPlayingChannel(null)} style={{background: 'linear-gradient(135deg, #ef4444, #dc2626)'}}>&#9632; Stop</button>
                )}
                <div className="epg-live-badge">LIVE</div>
              </div>

              {/* Inline Video Player */}
              {playingChannel && api && (
                <div className="inline-player-container">
                  <VideoPlayer
                    url={api.getLiveUrl(playingChannel.stream_id, 'ts')}
                    title={playingChannel.name}
                    onClose={() => setPlayingChannel(null)}
                    inline={true}
                  />
                </div>
              )}

              <div className="epg-programs">
                {epgData.map((prog, idx) => (
                  <div key={prog.id} className={`epg-prog ${idx % 2 === 1 ? 'epg-purple' : ''} ${isCurrentProgram(prog) ? 'current' : ''} ${isPastProgram(prog) ? 'past' : ''}`}>
                    <div className="epg-prog-time">{formatTime(prog.start)}</div>
                    <div className="epg-prog-details">
                      <div className="epg-prog-title">{prog.title}</div>
                      <div className="epg-prog-desc">{prog.description}</div>
                      {isCurrentProgram(prog) && (
                        <div className="epg-prog-progress">
                          <div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="epg-empty">
              <div style={{ fontSize: 48 }}>&#128250;</div>
              <p>Select a channel to view EPG</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── VOD / SERIES SCREEN ── */
function MediaScreen({ type, onBack, api }) {
  const isVod = type === 'vod';
  const title = isVod ? 'Movies' : 'Series';

  const [categories, setCategories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [playingItem, setPlayingItem] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [epPage, setEpPage] = useState(0);
  const EP_PER_PAGE = 20;
  const favType = isVod ? 'vod' : 'series';
  const [favs, setFavs] = useState(() => getFavorites(favType));
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [sortBy, setSortBy] = useState('default'); // default, name, rating

  const handleToggleFav = (e, itemId) => {
    e.stopPropagation();
    setFavs(toggleFavorite(favType, itemId));
  };

  // Load categories on mount
  useEffect(() => {
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      const fallbackCats = isVod ? mockData.vodCategories : mockData.seriesCategories;
      if (api) {
        const cats = isVod ? await api.getVodCategories() : await api.getSeriesCategories();
        if (!cancelled) {
          const catList = cats && Array.isArray(cats) && cats.length > 0 ? cats : fallbackCats;
          setCategories(catList);
          setSelectedCategory(catList[0]?.category_id);
        }
      } else {
        setCategories(fallbackCats);
        setSelectedCategory(fallbackCats[0]?.category_id);
        setAllItems(isVod ? mockData.vodStreams : mockData.series);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api, type]);

  // Load items when category changes
  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchItems = async () => {
      setItemsLoading(true);
      const items = isVod
        ? await api.getVodStreams(selectedCategory)
        : await api.getSeries(selectedCategory);
      if (!cancelled && items && Array.isArray(items)) {
        setAllItems(items);
      }
      if (!cancelled) setItemsLoading(false);
    };
    fetchItems();
    return () => { cancelled = true; };
  }, [selectedCategory, api, type]);

  const filtered = useMemo(() => {
    const itemId = (i) => i.stream_id || i.series_id;
    let list = allItems.filter(item => {
      const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFav = !showFavsOnly || favs.includes(itemId(item));
      return matchSearch && matchFav;
    });
    if (sortBy === 'name') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'rating') list = [...list].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    return list;
  }, [allItems, searchQuery, showFavsOnly, favs, sortBy]);

  // Pagination - show items in batches of 40
  const BATCH_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const gridRef = useRef(null);

  // Reset visible count when category or search changes
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [selectedCategory, searchQuery]);

  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleScroll = useCallback(() => {
    if (!gridRef.current || !hasMore) return;
    const el = gridRef.current;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filtered.length));
    }
  }, [hasMore, filtered.length]);

  // Handle series click - fetch seasons/episodes
  const handleSeriesClick = async (item) => {
    if (isVod) return; // VOD doesn't have episodes
    setSelectedSeries(item);
    setSeriesLoading(true);
    if (api) {
      const info = await api.getSeriesInfo(item.series_id);
      if (info) {
        setSeriesInfo(info);
      }
    }
    setSeriesLoading(false);
  };

  // Series detail view
  if (selectedSeries && !isVod) {
    const seasons = seriesInfo?.episodes ? Object.keys(seriesInfo.episodes).sort((a, b) => Number(a) - Number(b)) : [];
    const currentSeason = activeSeason || seasons[0];
    const allEpisodes = currentSeason && seriesInfo?.episodes?.[currentSeason] ? seriesInfo.episodes[currentSeason] : [];
    const totalEpPages = Math.ceil(allEpisodes.length / EP_PER_PAGE);
    const currentEpisodes = allEpisodes.slice(epPage * EP_PER_PAGE, (epPage + 1) * EP_PER_PAGE);
    return (
      <div className="section-screen">
        <div className="section-header">
          <button className="back-btn" onClick={() => { setSelectedSeries(null); setSeriesInfo(null); setActiveSeason(null); setEpPage(0); }}>&#8592; Back</button>
          <h1 className="section-title">{selectedSeries.name}</h1>
        </div>
        <div className="section-body">
          <div className="series-detail">
            <div className="series-detail-top">
              {(selectedSeries.cover || selectedSeries.stream_icon) && (
                <img className="series-detail-cover" src={selectedSeries.cover || selectedSeries.stream_icon} alt="" />
              )}
              <div className="series-detail-info">
                <h2>{selectedSeries.name}</h2>
                {seriesInfo?.info?.plot && <p className="series-plot">{seriesInfo.info.plot}</p>}
                {seriesInfo?.info?.genre && <p className="series-meta">Genre: {seriesInfo.info.genre}</p>}
                {seriesInfo?.info?.releaseDate && <p className="series-meta">Released: {seriesInfo.info.releaseDate}</p>}
                {selectedSeries.rating && selectedSeries.rating !== '0' && <p className="series-meta">Rating: {selectedSeries.rating}</p>}
              </div>
            </div>

            {seriesLoading && <div className="loading-indicator">Loading episodes...</div>}

            {/* Season Tabs */}
            {!seriesLoading && seasons.length > 0 && (
              <>
                <div className="season-tabs">
                  {seasons.map(season => (
                    <button
                      key={season}
                      className={`season-tab ${(currentSeason === season) ? 'active' : ''}`}
                      onClick={() => { setActiveSeason(season); setEpPage(0); }}
                    >
                      Season {season}
                      <span className="season-tab-count">{seriesInfo.episodes[season].length}</span>
                    </button>
                  ))}
                </div>

                {/* Episode count & pagination header */}
                <div className="ep-pagination-header">
                  <span className="ep-count">{allEpisodes.length} episodes</span>
                  {totalEpPages > 1 && (
                    <div className="ep-pagination">
                      <button className="ep-page-btn" disabled={epPage === 0} onClick={() => setEpPage(p => p - 1)}>&#8592; Prev</button>
                      <span className="ep-page-info">Page {epPage + 1} of {totalEpPages}</span>
                      <button className="ep-page-btn" disabled={epPage >= totalEpPages - 1} onClick={() => setEpPage(p => p + 1)}>Next &#8594;</button>
                    </div>
                  )}
                </div>

                <div className="series-episodes">
                  {currentEpisodes.map(ep => (
                    <div key={ep.id} className="series-episode" onClick={() => setPlayingItem({
                      stream_id: ep.id, name: ep.title || `Episode ${ep.episode_num}`,
                      container_extension: ep.container_extension || 'mp4', isSeries: true
                    })}>
                      <span className="ep-num">E{ep.episode_num}</span>
                      <div className="ep-info">
                        <div className="ep-title">{ep.title || `Episode ${ep.episode_num}`}</div>
                        {ep.info?.duration && <span className="ep-duration">{ep.info.duration}</span>}
                      </div>
                      <span className="ep-play">&#9654;</span>
                    </div>
                  ))}
                </div>

                {/* Bottom pagination */}
                {totalEpPages > 1 && (
                  <div className="ep-pagination" style={{justifyContent: 'center', marginTop: 12}}>
                    <button className="ep-page-btn" disabled={epPage === 0} onClick={() => setEpPage(p => p - 1)}>&#8592; Prev</button>
                    <span className="ep-page-info">Page {epPage + 1} of {totalEpPages}</span>
                    <button className="ep-page-btn" disabled={epPage >= totalEpPages - 1} onClick={() => setEpPage(p => p + 1)}>Next &#8594;</button>
                  </div>
                )}
              </>
            )}
            {!seriesLoading && seasons.length === 0 && <div className="loading-indicator">No episode data available</div>}
          </div>
        </div>

        {/* Episode Video Player */}
        {playingItem && api && (
          <VideoPlayer
            url={api.getSeriesUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')}
            title={playingItem.name || playingItem.title}
            onClose={() => setPlayingItem(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">{title}</h1>
        <div className="section-header-right">
          <button className={`header-filter-btn ${showFavsOnly ? 'active' : ''}`} onClick={() => setShowFavsOnly(!showFavsOnly)} title="Favorites only">&#9733;</button>
          <select className="header-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="default">Default</option>
            <option value="name">A-Z</option>
            <option value="rating">Rating</option>
          </select>
          <span className="channel-count">{filtered.length} titles</span>
        </div>
      </div>

      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder={`Search ${title.toLowerCase()}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div
                key={cat.category_id}
                className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}
              >
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-media-grid" ref={gridRef} onScroll={handleScroll}>
          {(loading || itemsLoading) && <div className="loading-indicator">Loading {title.toLowerCase()}...</div>}
          {!loading && !itemsLoading && visibleItems.map(item => {
            const posterUrl = item.stream_icon || item.cover || '';
            const itemName = item.name || item.title || '?';
            const itemId = item.stream_id || item.series_id;
            return (
              <div key={itemId} className="media-card"
                onClick={() => {
                  if (isVod) {
                    setPlayingItem(item);
                    addToHistory({ id: `vod_${item.stream_id}`, name: item.name, type: 'vod', streamId: item.stream_id, icon: posterUrl });
                  } else {
                    handleSeriesClick(item);
                  }
                }}>
                <div className="media-poster"
                  style={posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                >
                  {!posterUrl && <span className="media-poster-letter">{itemName.charAt(0)}</span>}
                  <div className="media-play-overlay">&#9654;</div>
                  <button className={`media-fav-btn ${favs.includes(itemId) ? 'active' : ''}`} onClick={(e) => handleToggleFav(e, itemId)}>&#9733;</button>
                </div>
                <div className="media-info">
                  <div className="media-title">{itemName}</div>
                  {item.rating && item.rating !== '0' && String(item.rating) !== '0' && (
                    <div className="media-rating">
                      <span className="media-star">&#9733;</span> {item.rating}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {hasMore && <div className="loading-indicator" style={{gridColumn: '1 / -1'}}>Showing {visibleCount} of {filtered.length} - scroll for more</div>}
        </div>
      </div>

      {/* VOD / Episode Video Player */}
      {playingItem && api && (
        <VideoPlayer
          url={playingItem.isSeries
            ? api.getSeriesUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')
            : api.getVodUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')}
          title={playingItem.name || playingItem.title}
          onClose={() => setPlayingItem(null)}
        />
      )}
    </div>
  );
}

/* ── RADIO SCREEN ── */
function RadioScreen({ onBack }) {
  const radioCategories = [
    { id: 'all', name: 'All Stations' },
    { id: 'pop', name: 'Pop' },
    { id: 'rock', name: 'Rock' },
    { id: 'jazz', name: 'Jazz' },
    { id: 'classical', name: 'Classical' },
    { id: 'hiphop', name: 'Hip Hop' },
    { id: 'electronic', name: 'Electronic' },
    { id: 'country', name: 'Country' },
    { id: 'news', name: 'News & Talk' },
  ];
  const radioStations = [
    { id: 1, name: 'BBC Radio 1', cat: 'pop', genre: 'Pop & Chart' },
    { id: 2, name: 'Capital FM', cat: 'pop', genre: 'Pop Hits' },
    { id: 3, name: 'Kiss FM', cat: 'pop', genre: 'Dance & Pop' },
    { id: 4, name: 'Heart Radio', cat: 'pop', genre: 'Feel Good Hits' },
    { id: 5, name: 'Radio X', cat: 'rock', genre: 'Alternative Rock' },
    { id: 6, name: 'Planet Rock', cat: 'rock', genre: 'Classic Rock' },
    { id: 7, name: 'Kerrang Radio', cat: 'rock', genre: 'Rock & Metal' },
    { id: 8, name: 'Absolute Rock', cat: 'rock', genre: 'Rock Hits' },
    { id: 9, name: 'Jazz FM', cat: 'jazz', genre: 'Smooth Jazz' },
    { id: 10, name: 'Smooth Jazz 24/7', cat: 'jazz', genre: 'Jazz Lounge' },
    { id: 11, name: 'Blue Note Radio', cat: 'jazz', genre: 'Jazz Classics' },
    { id: 12, name: 'Classic FM', cat: 'classical', genre: 'Classical Music' },
    { id: 13, name: 'BBC Radio 3', cat: 'classical', genre: 'Classical & Arts' },
    { id: 14, name: 'Scala Radio', cat: 'classical', genre: 'Modern Classical' },
    { id: 15, name: 'Power 105.1', cat: 'hiphop', genre: 'Hip Hop & R&B' },
    { id: 16, name: 'Hot 97', cat: 'hiphop', genre: 'Hip Hop Hits' },
    { id: 17, name: 'Rinse FM', cat: 'electronic', genre: 'Electronic & Dance' },
    { id: 18, name: 'Ministry of Sound', cat: 'electronic', genre: 'House & EDM' },
    { id: 19, name: 'BBC Radio 4', cat: 'news', genre: 'News & Documentaries' },
    { id: 20, name: 'LBC Radio', cat: 'news', genre: 'Talk & Debate' },
    { id: 21, name: 'NPR Radio', cat: 'news', genre: 'Public Radio' },
    { id: 22, name: 'Country Hits Radio', cat: 'country', genre: 'Country Music' },
    { id: 23, name: 'The Highway', cat: 'country', genre: 'New Country' },
    { id: 24, name: 'Willie\'s Roadhouse', cat: 'country', genre: 'Classic Country' },
  ];

  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playing, setPlaying] = useState(null);

  const filtered = radioStations.filter(s => {
    const matchCat = selectedCat === 'all' || s.cat === selectedCat;
    const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Radio</h1>
        <div className="section-header-right">
          <span className="channel-count">{filtered.length} stations</span>
        </div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder="Search stations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sidebar-categories">
            {radioCategories.map(cat => (
              <div key={cat.id} className={`sidebar-cat-item ${selectedCat === cat.id ? 'active' : ''}`} onClick={() => setSelectedCat(cat.id)}>
                <span>{cat.name}</span>
                <span className="sidebar-cat-count">
                  {cat.id === 'all' ? radioStations.length : radioStations.filter(s => s.cat === cat.id).length}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="radio-grid">
          {filtered.map(station => (
            <div key={station.id} className={`radio-card ${playing?.id === station.id ? 'playing' : ''}`} onClick={() => setPlaying(station)}>
              <div className="radio-icon">&#127911;</div>
              <div className="radio-info">
                <div className="radio-name">{station.name}</div>
                <div className="radio-genre">{station.genre}</div>
              </div>
              {playing?.id === station.id && <div className="radio-playing-indicator">
                <span className="radio-bar"></span>
                <span className="radio-bar"></span>
                <span className="radio-bar"></span>
              </div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── SETTINGS SCREEN ── */
function SettingsScreen({ onBack, api }) {
  const [device, setDevice] = useState(() => getDeviceIdentity());
  const [pinEnabled, setPinEnabled] = useState(() => localStorage.getItem('dash_pin_enabled') === 'true');
  const [pin, setPin] = useState(() => localStorage.getItem('dash_pin') || '');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState({
    status: 'Active',
    expDate: '2027-03-15',
    maxConnections: 2,
    activeCons: 1,
    username: 'demo_user',
    createdAt: '2025-01-10',
    isTrial: false,
  });

  useEffect(() => {
    if (api) {
      setAccountLoading(true);
      api.authenticate().then(data => {
        if (data && data.user_info) {
          const u = data.user_info;
          const expDate = u.exp_date || 'Unlimited';
          setAccountInfo({
            status: u.status || 'Active',
            expDate: expDate === '' || expDate === '0' ? 'Unlimited' : expDate,
            maxConnections: u.max_connections || 1,
            activeCons: u.active_cons || 0,
            username: u.username || 'N/A',
            createdAt: u.created_at || 'N/A',
            isTrial: u.is_trial === '1' || u.is_trial === 1,
          });
        }
        setAccountLoading(false);
      });
    } else {
      setAccountLoading(false);
    }
  }, [api]);

  const handleSetPin = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMsg('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg('PINs do not match');
      return;
    }
    localStorage.setItem('dash_pin', newPin);
    localStorage.setItem('dash_pin_enabled', 'true');
    setPin(newPin);
    setPinEnabled(true);
    setNewPin('');
    setConfirmPin('');
    setPinMsg('PIN set successfully!');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const handleDisablePin = () => {
    localStorage.removeItem('dash_pin');
    localStorage.setItem('dash_pin_enabled', 'false');
    setPin('');
    setPinEnabled(false);
    setPinMsg('PIN protection disabled');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const handleResetDeviceKey = () => {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    const newKey = Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
    const newDevice = { ...device, key: newKey };
    localStorage.setItem('dash_device', JSON.stringify(newDevice));
    setDevice(newDevice);
    setShowResetConfirm(false);
    setResetMsg('Device Key has been reset. You will need to re-activate this device.');
    setTimeout(() => setResetMsg(''), 5000);
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'parental', label: 'Parental Control', icon: '🔒' },
    { id: 'device', label: 'Device Info', icon: '📱' },
    { id: 'about', label: 'About', icon: 'ℹ' },
  ];

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Settings</h1>
      </div>
      <div className="section-body">
        {/* Settings Sidebar */}
        <div className="section-sidebar">
          <div className="sidebar-categories" style={{ paddingTop: 12 }}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`sidebar-cat-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon} {tab.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          {activeTab === 'account' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">Account Information</h3>
                <p className="settings-card-desc">Your Xtream Codes subscription details from the provider.</p>
                <div className="settings-account-grid">
                  <div className="settings-account-item">
                    <div className="settings-account-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>&#10003;</div>
                    <div className="settings-account-detail">
                      <span className="settings-account-label">Account Status</span>
                      <span className="settings-account-value" style={{ color: '#10b981' }}>{accountInfo.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128197;</div>
                    <div className="settings-account-detail">
                      <span className="settings-account-label">Expire Date</span>
                      <span className="settings-account-value">{accountInfo.expDate}</span>
                    </div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128279;</div>
                    <div className="settings-account-detail">
                      <span className="settings-account-label">Max Connections</span>
                      <span className="settings-account-value">{accountInfo.maxConnections}</span>
                    </div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128101;</div>
                    <div className="settings-account-detail">
                      <span className="settings-account-label">Active Connections</span>
                      <span className="settings-account-value">{accountInfo.activeCons} / {accountInfo.maxConnections}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Subscription Details</h3>
                <div className="settings-device-info">
                  <div className="settings-device-row">
                    <span className="settings-device-label">Username</span>
                    <span className="settings-device-value">{accountInfo.username}</span>
                  </div>
                  <div className="settings-device-row">
                    <span className="settings-device-label">Created</span>
                    <span className="settings-device-value">{accountInfo.createdAt}</span>
                  </div>
                  <div className="settings-device-row">
                    <span className="settings-device-label">Trial Account</span>
                    <span className="settings-device-value">{accountInfo.isTrial ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="settings-device-row">
                    <span className="settings-device-label">User Agent</span>
                    <span className="settings-device-value">DashPlayer/1.0</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'parental' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">Adult Content PIN Lock</h3>
                <p className="settings-card-desc">
                  Set a 4-digit PIN to protect adult channels. Users will need to enter this PIN to view locked channels.
                </p>

                <div className="settings-status">
                  <span>Status:</span>
                  <span className={`settings-badge ${pinEnabled ? 'active' : 'inactive'}`}>
                    {pinEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {pinEnabled ? (
                  <div className="settings-pin-section">
                    <p className="settings-pin-info">PIN is currently set. You can change it or disable it.</p>
                    <div className="settings-pin-row">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="New PIN"
                        value={newPin}
                        onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="settings-pin-input"
                      />
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Confirm"
                        value={confirmPin}
                        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        className="settings-pin-input"
                      />
                      <button className="settings-btn settings-btn-primary" onClick={handleSetPin}>Change PIN</button>
                    </div>
                    <button className="settings-btn settings-btn-danger" onClick={handleDisablePin}>Disable PIN</button>
                  </div>
                ) : (
                  <div className="settings-pin-section">
                    <div className="settings-pin-row">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Enter 4-digit PIN"
                        value={newPin}
                        onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="settings-pin-input"
                      />
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="Confirm PIN"
                        value={confirmPin}
                        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        className="settings-pin-input"
                      />
                      <button className="settings-btn settings-btn-primary" onClick={handleSetPin}>Set PIN</button>
                    </div>
                  </div>
                )}

                {pinMsg && <p className={`settings-msg ${pinMsg.includes('successfully') ? 'success' : pinMsg.includes('disabled') ? 'info' : 'error'}`}>{pinMsg}</p>}
              </div>

              {pinEnabled && (
                <div className="settings-card">
                  <h3 className="settings-card-title">Locked Channels</h3>
                  <p className="settings-card-desc">
                    Channels marked as adult content will require PIN entry before viewing.
                    This is managed from the Admin Panel under device settings.
                  </p>
                  <div className="settings-locked-info">
                    <span className="settings-lock-icon">🔒</span>
                    <span>Channel locking is configured from the Admin Panel per playlist/bouquet.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'device' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">Device Information</h3>
                <div className="settings-device-info">
                  <div className="settings-device-row">
                    <span className="settings-device-label">MAC Address</span>
                    <span className="settings-device-value">{device.mac}</span>
                  </div>
                  <div className="settings-device-row">
                    <span className="settings-device-label">Device Key</span>
                    <span className="settings-device-value">{device.key}</span>
                  </div>
                  <div className="settings-device-row">
                    <span className="settings-device-label">App Version</span>
                    <span className="settings-device-value">1.0.0</span>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Reset Device Key</h3>
                <p className="settings-card-desc">
                  Generate a new device key. Warning: this will deactivate the current device and require re-activation from the Admin Panel.
                </p>
                {!showResetConfirm ? (
                  <button className="settings-btn settings-btn-danger" onClick={() => setShowResetConfirm(true)}>
                    Reset Device Key
                  </button>
                ) : (
                  <div className="settings-confirm-box">
                    <p className="settings-confirm-text">Are you sure? This will require re-activation.</p>
                    <div className="settings-confirm-btns">
                      <button className="settings-btn settings-btn-danger" onClick={handleResetDeviceKey}>Yes, Reset</button>
                      <button className="settings-btn settings-btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                {resetMsg && <p className="settings-msg info">{resetMsg}</p>}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-panel">
              <div className="settings-card" style={{ textAlign: 'center' }}>
                <div className="settings-about-logo">D</div>
                <h2 className="settings-about-name">Dash Player</h2>
                <p className="settings-about-version">Version 1.0.0</p>
                <p className="settings-card-desc" style={{ marginTop: 16 }}>
                  Multi-platform IPTV player with Xtream Codes support.
                  Supports Live TV, Movies, Series, Radio, Catch Up, and EPG.
                </p>
                <div className="settings-about-links">
                  <span>Support: panel.dashplayer.tv</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── TRIAL EXPIRED SCREEN ── */
function TrialExpiredScreen() {
  const [device] = useState(() => getDeviceIdentity());
  const panelUrl = 'https://panel.dashplayer.tv';
  const qrSize = 140;

  return (
    <div className="activation-screen">
      <div className="activation-container">
        <div className="activation-info">
          <div className="activation-info-inner">
            <div className="trial-expired-icon">&#9888;</div>
            <h2 className="trial-expired-title">Your Trial Has Ended</h2>
            <p className="trial-expired-desc">
              Your free trial period has expired. To continue using Dash Player,
              please activate your device using the details below.
            </p>

            <a href={panelUrl} className="activation-url">{panelUrl}</a>

            <div className="activation-field">
              <label className="activation-label">Mac Address</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.mac}</span>
              </div>
            </div>

            <div className="activation-field">
              <label className="activation-label">Device Key</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.key}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="activation-brand">
          <div className="activation-logo">D</div>
          <div className="activation-app-name">Dash Player</div>
          <div className="activation-qr">
            <div className="activation-qr-placeholder">
              <svg width={qrSize} height={qrSize} viewBox="0 0 140 140">
                <rect width="140" height="140" rx="12" fill="white"/>
                <rect x="12" y="12" width="36" height="36" rx="4" fill="#7c3aed"/>
                <rect x="18" y="18" width="24" height="24" rx="2" fill="white"/>
                <rect x="24" y="24" width="12" height="12" rx="1" fill="#7c3aed"/>
                <rect x="92" y="12" width="36" height="36" rx="4" fill="#7c3aed"/>
                <rect x="98" y="18" width="24" height="24" rx="2" fill="white"/>
                <rect x="104" y="24" width="12" height="12" rx="1" fill="#7c3aed"/>
                <rect x="12" y="92" width="36" height="36" rx="4" fill="#7c3aed"/>
                <rect x="18" y="98" width="24" height="24" rx="2" fill="white"/>
                <rect x="24" y="104" width="12" height="12" rx="1" fill="#7c3aed"/>
                <rect x="56" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="72" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="72" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="88" y="56" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="56" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="72" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="88" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="104" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="120" y="88" width="8" height="8" rx="1" fill="#7c3aed"/>
                <rect x="52" y="52" width="16" height="16" rx="4" fill="#7c3aed"/>
                <text x="60" y="64" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">D</text>
              </svg>
            </div>
          </div>
          <p className="activation-qr-text">Scan to activate</p>
        </div>
      </div>
    </div>
  );
}

/* ── FAVORITES SCREEN ── */
function FavoritesScreen({ onBack, api }) {
  const [activeTab, setActiveTab] = useState('live');
  const [playingItem, setPlayingItem] = useState(null);
  const history = getWatchHistory();

  const tabs = [
    { id: 'live', label: 'Live TV', icon: '&#128250;' },
    { id: 'vod', label: 'Movies', icon: '&#127910;' },
    { id: 'series', label: 'Series', icon: '&#127916;' },
    { id: 'history', label: 'Recently Watched', icon: '&#128340;' },
  ];

  const liveFavs = getFavorites('live');
  const vodFavs = getFavorites('vod');
  const seriesFavs = getFavorites('series');

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Favorites</h1>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-categories" style={{ paddingTop: 12 }}>
            {tabs.map(tab => (
              <div key={tab.id} className={`sidebar-cat-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}>
                <span dangerouslySetInnerHTML={{ __html: tab.icon + ' ' + tab.label }} />
                <span className="sidebar-cat-count">
                  {tab.id === 'live' ? liveFavs.length : tab.id === 'vod' ? vodFavs.length : tab.id === 'series' ? seriesFavs.length : history.length}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="favorites-content">
          {activeTab === 'history' ? (
            history.length === 0 ? (
              <div className="epg-empty"><div style={{ fontSize: 48 }}>&#128340;</div><p>No watch history yet</p></div>
            ) : (
              <div className="history-list">
                {history.map(item => (
                  <div key={item.id} className="history-item" onClick={() => {
                    if (item.type === 'live' && api) setPlayingItem({ url: api.getLiveUrl(item.streamId, 'ts'), name: item.name });
                    else if (item.type === 'vod' && api) setPlayingItem({ url: api.getVodUrl(item.streamId, 'mp4'), name: item.name });
                  }}>
                    {item.icon ? <img className="history-icon" src={item.icon} alt="" onError={e => e.target.style.display='none'} /> : null}
                    <div className="history-info">
                      <div className="history-name">{item.name}</div>
                      <div className="history-meta">{item.type === 'live' ? 'Live TV' : item.type === 'vod' ? 'Movie' : 'Series'} - {new Date(item.watchedAt).toLocaleDateString()}</div>
                    </div>
                    <span className="ep-play">&#9654;</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="epg-empty">
              <div style={{ fontSize: 48 }}>&#9733;</div>
              <p>{activeTab === 'live' ? `${liveFavs.length} favorite channels` : activeTab === 'vod' ? `${vodFavs.length} favorite movies` : `${seriesFavs.length} favorite series`}</p>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8 }}>Add favorites from the {activeTab === 'live' ? 'Live TV' : activeTab === 'vod' ? 'Movies' : 'Series'} section using the star button</p>
            </div>
          )}
        </div>
      </div>
      {playingItem && (
        <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}

/* ── CATCH UP SCREEN ── */
function CatchUpScreen({ onBack, api }) {
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      const cats = await api.getLiveCategories();
      if (!cancelled && cats && Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
        setSelectedCategory(cats[0].category_id);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCats();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchStreams = async () => {
      setChannelLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) {
        // Filter channels that support catch-up (tv_archive = 1)
        setChannels(streams.filter(s => s.tv_archive === 1 || s.tv_archive === '1'));
      }
      if (!cancelled) setChannelLoading(false);
    };
    fetchStreams();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  const filtered = channels.filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Catch Up TV</h1>
        <div className="section-header-right">
          <span className="channel-count">{filtered.length} channels with catch-up</span>
        </div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder="Search catch-up..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="section-channel-list">
          {(loading || channelLoading) && <div className="loading-indicator">Loading catch-up channels...</div>}
          {!loading && !channelLoading && filtered.length === 0 && (
            <div className="epg-empty"><div style={{ fontSize: 48 }}>&#9202;</div><p>No catch-up channels in this category</p></div>
          )}
          {!loading && !channelLoading && filtered.map(ch => (
            <div key={ch.stream_id} className="ch-item">
              {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : null}
              <div className="ch-icon" style={ch.stream_icon ? { display: 'none' } : {}}>{(ch.name || '?').charAt(0)}</div>
              <div className="ch-info">
                <div className="ch-name">{ch.name}</div>
                <div className="ch-prog">Archive: {ch.tv_archive_duration || '?'} days</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── SEARCH SCREEN (Global search across all content) ── */
function SearchScreen({ onBack, api }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ live: [], vod: [], series: [] });
  const [searching, setSearching] = useState(false);
  const [playingItem, setPlayingItem] = useState(null);
  const searchTimeout = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2 || !api) { setResults({ live: [], vod: [], series: [] }); return; }
    setSearching(true);
    const [live, vod, series] = await Promise.all([
      api.getLiveStreams(),
      api.getVodStreams(),
      api.getSeries(),
    ]);
    const lq = q.toLowerCase();
    setResults({
      live: (live || []).filter(c => c.name?.toLowerCase().includes(lq)).slice(0, 20),
      vod: (vod || []).filter(v => v.name?.toLowerCase().includes(lq)).slice(0, 20),
      series: (series || []).filter(s => s.name?.toLowerCase().includes(lq)).slice(0, 20),
    });
    setSearching(false);
  }, [api]);

  const handleInput = (val) => {
    setQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 500);
  };

  const totalResults = results.live.length + results.vod.length + results.series.length;

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Search</h1>
      </div>
      <div className="search-screen-body">
        <div className="search-input-bar">
          <input className="search-global-input" placeholder="Search channels, movies, series..." value={query} onChange={e => handleInput(e.target.value)} autoFocus />
        </div>
        {searching && <div className="loading-indicator">Searching...</div>}
        {!searching && query.length >= 2 && totalResults === 0 && (
          <div className="epg-empty"><div style={{ fontSize: 48 }}>&#128269;</div><p>No results for "{query}"</p></div>
        )}
        {!searching && totalResults > 0 && (
          <div className="search-results">
            {results.live.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">Live TV ({results.live.length})</h3>
                <div className="search-items">
                  {results.live.map(ch => (
                    <div key={ch.stream_id} className="search-result-item" onClick={() => {
                      if (api) setPlayingItem({ url: api.getLiveUrl(ch.stream_id, 'ts'), name: ch.name });
                      addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon });
                    }}>
                      {ch.stream_icon ? <img className="search-result-icon" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="search-result-letter">{ch.name?.charAt(0)}</div>}
                      <div className="search-result-info"><div className="search-result-name">{ch.name}</div><div className="search-result-type">Live TV</div></div>
                      <span className="ep-play">&#9654;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {results.vod.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">Movies ({results.vod.length})</h3>
                <div className="search-items">
                  {results.vod.map(item => (
                    <div key={item.stream_id} className="search-result-item" onClick={() => {
                      if (api) setPlayingItem({ url: api.getVodUrl(item.stream_id, item.container_extension || 'mp4'), name: item.name });
                      addToHistory({ id: `vod_${item.stream_id}`, name: item.name, type: 'vod', streamId: item.stream_id, icon: item.stream_icon });
                    }}>
                      {item.stream_icon ? <img className="search-result-icon" src={item.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="search-result-letter">{item.name?.charAt(0)}</div>}
                      <div className="search-result-info"><div className="search-result-name">{item.name}</div><div className="search-result-type">Movie {item.rating && item.rating !== '0' ? `- ★ ${item.rating}` : ''}</div></div>
                      <span className="ep-play">&#9654;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {results.series.length > 0 && (
              <div className="search-section">
                <h3 className="search-section-title">Series ({results.series.length})</h3>
                <div className="search-items">
                  {results.series.map(item => (
                    <div key={item.series_id} className="search-result-item">
                      {item.cover ? <img className="search-result-icon" src={item.cover} alt="" onError={e => e.target.style.display='none'} /> : <div className="search-result-letter">{item.name?.charAt(0)}</div>}
                      <div className="search-result-info"><div className="search-result-name">{item.name}</div><div className="search-result-type">Series {item.rating && item.rating !== '0' ? `- ★ ${item.rating}` : ''}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {playingItem && <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />}
    </div>
  );
}

/* ── Player license helper ── */
function getPlayerLicense() {
  // In production: fetched from admin panel API during device auth
  // Returns: { type: 'unlimited' | 'yearly' | 'trial', expiresAt: null | '2027-03-15', trialDaysLeft: 0 }
  // For demo: simulate trial with 15 days left
  return { type: 'trial', expiresAt: null, trialDaysLeft: 15 };
}

function getPlayerStatusText(license) {
  if (license.type === 'unlimited') return 'Unlimited';
  if (license.type === 'yearly') return license.expiresAt;
  if (license.type === 'trial') {
    if (license.trialDaysLeft <= 0) return 'Expired';
    return `${license.trialDaysLeft} days left`;
  }
  return 'Unknown';
}

/* ── MAIN APP ── */
export default function App() {
  const [credentials, setCredentials] = useState(null);
  const [screen, setScreen] = useState('home');
  const [playerLicense] = useState(() => getPlayerLicense());
  const [api, setApi] = useState(null);

  // Create API instance when credentials change
  useEffect(() => {
    if (credentials && credentials.url && credentials.username && credentials.password) {
      setApi(createXtreamApi(credentials.url, credentials.username, credentials.password));
    }
  }, [credentials]);

  // Check if trial has expired
  const isTrialExpired = playerLicense.type === 'trial' && playerLicense.trialDaysLeft <= 0;

  if (!credentials) {
    return <ActivationScreen onActivated={(creds) => { setCredentials(creds); setScreen('home'); }} />;
  }

  // If trial expired, show the expired screen (block all content)
  if (isTrialExpired) {
    return <TrialExpiredScreen />;
  }

  const handleNavigate = (section) => setScreen(section);

  switch (screen) {
    case 'live':
      return <LiveTVScreen onBack={() => setScreen('home')} api={api} />;
    case 'vod':
      return <MediaScreen type="vod" onBack={() => setScreen('home')} api={api} />;
    case 'series':
      return <MediaScreen type="series" onBack={() => setScreen('home')} api={api} />;
    case 'radio':
      return <RadioScreen onBack={() => setScreen('home')} />;
    case 'settings':
      return <SettingsScreen onBack={() => setScreen('home')} api={api} />;
    case 'favorites':
      return <FavoritesScreen onBack={() => setScreen('home')} api={api} onNavigate={handleNavigate} />;
    case 'catchup':
      return <CatchUpScreen onBack={() => setScreen('home')} api={api} />;
    case 'search':
      return <SearchScreen onBack={() => setScreen('home')} api={api} />;
    default:
      return <HomeScreen onNavigate={handleNavigate} credentials={credentials} playerLicense={playerLicense} />;
  }
}
