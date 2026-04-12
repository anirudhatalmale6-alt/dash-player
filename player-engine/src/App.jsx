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

/* ── Playlist management helper (localStorage) ── */
function getPlaylists() {
  try { return JSON.parse(localStorage.getItem('dash_playlists') || '[]'); } catch { return []; }
}
function savePlaylists(playlists) {
  localStorage.setItem('dash_playlists', JSON.stringify(playlists));
}
function getDefaultPlaylist() {
  const pls = getPlaylists();
  return pls.find(p => p.is_default) || pls[0] || null;
}

/* ── Custom groups helper (persisted in localStorage) ── */
function getCustomGroups() {
  try { return JSON.parse(localStorage.getItem('dash_custom_groups') || '[]'); } catch { return []; }
}
function saveCustomGroups(groups) {
  localStorage.setItem('dash_custom_groups', JSON.stringify(groups));
}

/* ── Watch history helper ── */
function getWatchHistory() {
  try { return JSON.parse(localStorage.getItem('dash_history') || '[]'); } catch { return []; }
}
function addToHistory(item) {
  const hist = getWatchHistory().filter(h => h.id !== item.id);
  hist.unshift({ ...item, watchedAt: Date.now() });
  if (hist.length > 50) hist.length = 50;
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
    getFullEPG: (streamId) => req('get_simple_data_table', { stream_id: streamId }),
    getLiveUrl: (streamId, ext = 'ts') => `${baseUrl}/live/${username}/${password}/${streamId}.${ext}`,
    getVodUrl: (streamId, ext = 'mp4') => `${baseUrl}/movie/${username}/${password}/${streamId}.${ext}`,
    getSeriesUrl: (streamId, ext = 'mp4') => `${baseUrl}/series/${username}/${password}/${streamId}.${ext}`,
    getTimeshiftUrl: (streamId, start, duration) => `${baseUrl}/timeshift/${username}/${password}/${duration}/${start}/${streamId}.ts`,
  };
}

/* ── Generate a persistent device identity ── */
function getDeviceIdentity() {
  let stored = localStorage.getItem('dash_device');
  if (stored) return JSON.parse(stored);
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  const mac = `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
  const key = Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
  const device = { mac, key };
  localStorage.setItem('dash_device', JSON.stringify(device));
  return device;
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

/* ══════ ACTIVATION SCREEN ══════ */
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
  const panelUrl = 'https://dashplayer.eu';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

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
    setTimeout(() => {
      setChecking(false);
      onActivated({ url: 'http://demo', username: 'demo', password: 'demo' });
    }, 1500);
  };

  const qrSize = 140;

  return (
    <div className="activation-screen">
      <div className="activation-container">
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
                  {copied === 'mac' ? '\u2713' : '\u29C9'}
                </button>
              </div>
            </div>
            <div className="activation-field">
              <label className="activation-label">Device Key</label>
              <div className="activation-value-row">
                <span className="activation-value">{device.key}</span>
                <button className="activation-copy" onClick={() => copyToClipboard(device.key, 'key')}>
                  {copied === 'key' ? '\u2713' : '\u29C9'}
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
                  <input className="quick-connect-input" placeholder="http://server:port/get.php?username=...&password=..." value={m3uInput} onChange={e => handleM3uPaste(e.target.value)} />
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
        <div className="activation-brand">
          <div className="activation-logo">D</div>
          <div className="activation-app-name">Dash Player</div>
          <div className="activation-qr">
            <div className="activation-qr-placeholder">
              <svg width={qrSize} height={qrSize} viewBox="0 0 140 140">
                <rect width="140" height="140" rx="12" fill="rgba(255,255,255,0.1)"/>
                <rect x="12" y="12" width="36" height="36" rx="4" fill="#8b5cf6"/>
                <rect x="18" y="18" width="24" height="24" rx="2" fill="rgba(255,255,255,0.1)"/>
                <rect x="24" y="24" width="12" height="12" rx="1" fill="#8b5cf6"/>
                <rect x="92" y="12" width="36" height="36" rx="4" fill="#8b5cf6"/>
                <rect x="98" y="18" width="24" height="24" rx="2" fill="rgba(255,255,255,0.1)"/>
                <rect x="104" y="24" width="12" height="12" rx="1" fill="#8b5cf6"/>
                <rect x="12" y="92" width="36" height="36" rx="4" fill="#8b5cf6"/>
                <rect x="18" y="98" width="24" height="24" rx="2" fill="rgba(255,255,255,0.1)"/>
                <rect x="24" y="104" width="12" height="12" rx="1" fill="#8b5cf6"/>
                <rect x="56" y="56" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="72" y="56" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="56" y="72" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="88" y="56" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="56" y="88" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="72" y="88" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="88" y="88" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="104" y="88" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="120" y="88" width="8" height="8" rx="1" fill="#8b5cf6"/>
                <rect x="52" y="52" width="16" height="16" rx="4" fill="#8b5cf6"/>
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

/* ══════ VIDEO PLAYER COMPONENT ══════ */
function VideoPlayer({ url, onClose, title, inline }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const retryTimerRef = useRef(null);
  const stallTimerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentFormat, setCurrentFormat] = useState('');
  const mountedRef = useRef(true);

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
    cleanup();
    const video = videoRef.current;
    const isLive = url.includes('/live/') || url.includes('/timeshift/');
    const baseUrl = url.replace(/\.\w+$/, '');

    const setupStallDetection = () => {
      if (stallTimerRef.current) clearInterval(stallTimerRef.current);
      let lastTime = 0;
      let stallCount = 0;
      stallTimerRef.current = setInterval(() => {
        if (!video || video.paused || video.ended) return;
        if (video.currentTime === lastTime && video.readyState < 3) {
          stallCount++;
          if (stallCount >= 3) {
            stallCount = 0;
            if (playerRef.current && isLive) {
              try {
                const buffered = video.buffered;
                if (buffered.length > 0) video.currentTime = buffered.end(buffered.length - 1) - 0.5;
              } catch(e) {}
            }
          }
        } else { stallCount = 0; }
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
      const player = mpegts.createPlayer({ type: 'mpegts', isLive, url: streamUrl }, {
        enableWorker: true, enableStashBuffer: false, stashInitialSize: 128,
        lazyLoad: false, lazyLoadMaxDuration: isLive ? 30 : 300,
        liveBufferLatencyChasing: isLive,
        liveBufferLatencyMaxLatency: isLive ? 3 : 60,
        liveBufferLatencyMinRemain: isLive ? 0.5 : 3,
        liveSyncTargetLatency: isLive ? 1.5 : undefined,
        autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15, seekType: 'range', fixAudioTimestampGap: true,
      });
      playerRef.current = player;
      player.attachMediaElement(video);
      player.load();
      let errorTriggered = false;
      player.on(mpegts.Events.ERROR, () => {
        if (errorTriggered) return;
        errorTriggered = true;
        cleanup();
        tryHls();
      });
      video.addEventListener('canplay', onPlaying, { once: true });
      video.addEventListener('playing', onPlaying, { once: true });
      setTimeout(() => { if (mountedRef.current && video) video.play().catch(() => {}); }, 300);
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (video.readyState < 2 && !errorTriggered) { errorTriggered = true; cleanup(); tryHls(); }
      }, 10000);
    };

    const tryHls = () => {
      if (!Hls.isSupported()) return tryDirect();
      if (!mountedRef.current) return;
      setCurrentFormat('HLS');
      const hlsUrl = baseUrl + '.m3u8';
      const hls = new Hls({
        enableWorker: true, maxBufferLength: isLive ? 10 : 60,
        maxMaxBufferLength: isLive ? 30 : 300, startLevel: -1,
        liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 6,
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
        if (data.fatal && !hlsErrorTriggered) { hlsErrorTriggered = true; cleanup(); tryDirect(); }
      });
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (video.readyState < 2 && !hlsErrorTriggered) { hlsErrorTriggered = true; cleanup(); tryDirect(); }
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
      tryMpegTs(baseUrl + '.ts');
    } else {
      setCurrentFormat('Direct');
      video.src = url;
      video.addEventListener('canplay', onPlaying, { once: true });
      video.addEventListener('playing', onPlaying, { once: true });
      let vodErrorTriggered = false;
      video.addEventListener('error', () => {
        if (vodErrorTriggered || !mountedRef.current) return;
        vodErrorTriggered = true;
        tryMpegTs(baseUrl + '.ts');
      }, { once: true });
      video.play().catch(() => {});
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || video.readyState >= 2) return;
        if (!vodErrorTriggered) { vodErrorTriggered = true; tryMpegTs(baseUrl + '.ts'); }
      }, 10000);
    }

    return () => { cleanup(); if (video) { video.src = ''; video.load(); } };
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

/* ══════ HOME SCREEN (Interactive) ══════ */
function HomeScreen({ onNavigate, credentials, playerLicense, contentStats }) {
  const [time, setTime] = useState(new Date());
  const [device] = useState(() => getDeviceIdentity());
  const history = getWatchHistory();

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="home-screen">
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
          <button className="home-notification-btn" onClick={() => onNavigate('multiscreen')} title="Multi Screen">
            &#9638;
            <div className="home-notification-dot" style={{display:'none'}} />
          </button>
        </div>
      </div>

      <div className="home-content">
        {/* Welcome */}
        <div className="home-welcome">
          <div className="home-welcome-text">{greeting()}</div>
          <div className="home-welcome-sub">What would you like to watch today?</div>
        </div>

        {/* Quick Stats */}
        <div className="home-stats">
          <div className="home-stat" onClick={() => onNavigate('live')}>
            <div className="home-stat-icon">&#128250;</div>
            <div className="home-stat-value">{contentStats.live || 0}</div>
            <div className="home-stat-label">Live Channels</div>
          </div>
          <div className="home-stat" onClick={() => onNavigate('vod')}>
            <div className="home-stat-icon">&#127910;</div>
            <div className="home-stat-value">{contentStats.vod || 0}</div>
            <div className="home-stat-label">Movies</div>
          </div>
          <div className="home-stat" onClick={() => onNavigate('series')}>
            <div className="home-stat-icon">&#127916;</div>
            <div className="home-stat-value">{contentStats.series || 0}</div>
            <div className="home-stat-label">Series</div>
          </div>
          <div className="home-stat" onClick={() => onNavigate('favorites')}>
            <div className="home-stat-icon">&#9733;</div>
            <div className="home-stat-value">{getFavorites('live').length + getFavorites('vod').length + getFavorites('series').length}</div>
            <div className="home-stat-label">Favorites</div>
          </div>
        </div>

        {/* Main Cards */}
        <div className="home-cards-main">
          <div className="home-card home-card-live" onClick={() => onNavigate('live')}>
            <div className="home-card-icon">&#128250;</div>
            <div className="home-card-label">Live TV</div>
            <div className="home-card-count">{contentStats.live || 0} channels</div>
          </div>
          <div className="home-card home-card-movies" onClick={() => onNavigate('vod')}>
            <div className="home-card-icon">&#127910;</div>
            <div className="home-card-label">Movies</div>
            <div className="home-card-count">{contentStats.vod || 0} titles</div>
          </div>
          <div className="home-card home-card-series" onClick={() => onNavigate('series')}>
            <div className="home-card-icon">&#127916;</div>
            <div className="home-card-label">Series</div>
            <div className="home-card-count">{contentStats.series || 0} shows</div>
          </div>
          <div className="home-card home-card-radio" onClick={() => onNavigate('radio')}>
            <div className="home-card-icon">&#127911;</div>
            <div className="home-card-label">Radio</div>
            <div className="home-card-count">24 stations</div>
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
          <div className="home-card-sm" onClick={() => onNavigate('multiscreen')}>
            <span className="home-card-sm-icon">&#9638;</span>
            <span>Multi Screen</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('playlists')}>
            <span className="home-card-sm-icon">&#128220;</span>
            <span>Playlists</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('speedtest')}>
            <span className="home-card-sm-icon">&#128246;</span>
            <span>Speed Test</span>
          </div>
          <div className="home-card-sm" onClick={() => onNavigate('settings')}>
            <span className="home-card-sm-icon">&#9881;</span>
            <span>Settings</span>
          </div>
        </div>

        {/* Recently Watched */}
        {history.length > 0 && (
          <div className="home-recently">
            <div className="home-section-title">Recently Watched</div>
            <div className="home-recently-scroll">
              {history.slice(0, 12).map(item => (
                <div key={item.id} className="home-recently-card" onClick={() => {
                  if (item.type === 'live') onNavigate('live');
                  else if (item.type === 'vod') onNavigate('vod');
                  else onNavigate('series');
                }}>
                  <div className="home-recently-poster" style={item.icon ? { backgroundImage: `url(${item.icon})` } : {}}>
                    {!item.icon && (item.type === 'live' ? '\u{1F4FA}' : item.type === 'vod' ? '\u{1F3AC}' : '\u{1F3A5}')}
                  </div>
                  <div className="home-recently-info">
                    <div className="home-recently-name">{item.name}</div>
                    <div className="home-recently-meta">{item.type === 'live' ? 'Live TV' : item.type === 'vod' ? 'Movie' : 'Series'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="home-bottombar">
        <div className="home-playlist-info">
          MAC: <strong>{device.mac}</strong>
        </div>
        <div className="home-version">{playerLicense.type === 'trial' ? 'Trial: ' : 'Activated: '}<strong>{getPlayerStatusText(playerLicense)}</strong></div>
      </div>
    </div>
  );
}

/* ══════ LIVE TV SCREEN ══════ */
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
  const [sortBy, setSortBy] = useState('default');
  const [showEpgOverlay, setShowEpgOverlay] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCats = async () => {
      setLoading(true);
      if (api) {
        const cats = await api.getLiveCategories();
        if (!cancelled && cats && Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
          setSelectedCategory(cats[0].category_id);
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

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchStreams = async () => {
      setChannelLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) setChannels(streams);
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
    if (selectedChannel && api) {
      api.getEPG(selectedChannel.stream_id).then(data => {
        if (data && data.epg_listings && data.epg_listings.length > 0) {
          setEpgData(data.epg_listings.map((e, i) => ({
            id: e.id || i,
            title: e.title ? b64decode(e.title) : 'No Title',
            description: e.description ? b64decode(e.description) : '',
            start: e.start, end: e.end,
          })));
        } else {
          setEpgData([]);
        }
      });
    }
  }, [selectedChannel, api]);

  const isCurrentProgram = (p) => { const n = new Date(); return new Date(p.start) <= n && new Date(p.end) > n; };
  const isPastProgram = (p) => new Date(p.end) < new Date();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const getProgress = (p) => { const n = new Date(); return Math.min(100, Math.max(0, ((n - new Date(p.start)) / (new Date(p.end) - new Date(p.start))) * 100)); };

  return (
    <div className="section-screen">
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
        <div className="section-sidebar">
          <div className="sidebar-search">
            <input placeholder="Search channels..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
        {!playingChannel ? (
          <>
            <div className="section-channel-list">
              {(loading || channelLoading) && <div className="loading-indicator">Loading channels...</div>}
              {!loading && !channelLoading && filtered.map(ch => (
                <div key={ch.stream_id} className={`ch-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel(ch); setPlayingChannel(ch); addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon }); }}>
                  <span className="ch-num">{ch.num || ch.stream_id}</span>
                  {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => { e.target.style.display = 'none'; if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} /> : null}
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
            <div className="section-epg">
              {selectedChannel ? (
                <>
                  <div className="epg-top">
                    <div>
                      <div className="epg-ch-name">{selectedChannel.name}</div>
                      <div className="epg-ch-cat">{selectedChannel.category_name}</div>
                    </div>
                    <button className="epg-play-btn" onClick={() => setPlayingChannel(selectedChannel)}>&#9654; Play</button>
                    <div className="epg-live-badge">LIVE</div>
                  </div>
                  <div className="epg-programs">
                    {epgData.map((prog, idx) => (
                      <div key={prog.id} className={`epg-prog ${idx % 2 === 1 ? 'epg-purple' : ''} ${isCurrentProgram(prog) ? 'current' : ''} ${isPastProgram(prog) ? 'past' : ''}`}>
                        <div className="epg-prog-time">{formatTime(prog.start)}</div>
                        <div className="epg-prog-details">
                          <div className="epg-prog-title">{prog.title}</div>
                          <div className="epg-prog-desc">{prog.description}</div>
                          {isCurrentProgram(prog) && (
                            <div className="epg-prog-progress"><div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} /></div>
                          )}
                        </div>
                      </div>
                    ))}
                    {epgData.length === 0 && <div className="epg-empty"><p>No EPG data available for this channel</p></div>}
                  </div>
                </>
              ) : (
                <div className="epg-empty">
                  <div style={{ fontSize: 48 }}>&#128250;</div>
                  <p>Select a channel to view EPG</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="live-player-area">
            <div className="live-player-main">
              <div className="live-player-top">
                <div className="live-player-info">
                  <span className="live-player-channel-name">{playingChannel.name}</span>
                  <span className="epg-live-badge">LIVE</span>
                </div>
                <div className="live-player-actions">
                  <button className="back-btn" onClick={() => setPlayingChannel(null)}>&#9632; Stop</button>
                </div>
              </div>
              <div className="live-player-video">
                {api && <VideoPlayer key={playingChannel.stream_id} url={api.getLiveUrl(playingChannel.stream_id, 'ts')} title={playingChannel.name} onClose={() => setPlayingChannel(null)} inline={true} />}
              </div>
              <div className="live-player-epg-bar" onClick={() => epgData.length > 0 && setShowEpgOverlay(v => !v)}>
                {epgData.length > 0 ? epgData.filter(p => isCurrentProgram(p) || !isPastProgram(p)).slice(0, 4).map((prog, idx) => (
                  <div key={prog.id} className={`live-epg-item ${isCurrentProgram(prog) ? 'current' : ''}`}>
                    <span className="live-epg-time">{formatTime(prog.start)}</span>
                    <span className="live-epg-title">{prog.title}</span>
                    {isCurrentProgram(prog) && (
                      <div className="epg-prog-progress" style={{ marginTop: 4 }}><div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} /></div>
                    )}
                  </div>
                )) : <div className="live-epg-item"><span className="live-epg-title" style={{ opacity: 0.5 }}>No EPG data available</span></div>}
              </div>
              {showEpgOverlay && epgData.length > 0 && (
                <div className="live-epg-overlay">
                  <div className="live-epg-overlay-close">
                    <h3>Program Guide</h3>
                    <button onClick={(e) => { e.stopPropagation(); setShowEpgOverlay(false); }}>&times;</button>
                  </div>
                  {epgData.map((prog, idx) => (
                    <div key={prog.id} className={`epg-prog ${idx % 2 === 1 ? 'epg-purple' : ''} ${isCurrentProgram(prog) ? 'current' : ''} ${isPastProgram(prog) ? 'past' : ''}`}>
                      <div className="epg-prog-time">{formatTime(prog.start)}</div>
                      <div className="epg-prog-details">
                        <div className="epg-prog-title">{prog.title}</div>
                        <div className="epg-prog-desc">{prog.description}</div>
                        {isCurrentProgram(prog) && (
                          <div className="epg-prog-progress"><div className="epg-prog-bar" style={{ width: `${getProgress(prog)}%` }} /></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="live-player-channels">
              {filtered.slice(0, 50).map(ch => (
                <div key={ch.stream_id} className={`ch-item ${playingChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel(ch); setPlayingChannel(ch); addToHistory({ id: `live_${ch.stream_id}`, name: ch.name, type: 'live', streamId: ch.stream_id, icon: ch.stream_icon }); }}>
                  <span className="ch-num">{ch.num || ch.stream_id}</span>
                  {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" style={{ width: 28, height: 28 }} onError={e => { e.target.style.display = 'none'; }} /> : null}
                  <div className="ch-info" style={{ minWidth: 0 }}>
                    <div className="ch-name" style={{ fontSize: 11 }}>{ch.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════ MEDIA SCREEN (Movies / Series) ══════ */
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
  const [sortBy, setSortBy] = useState('default');

  const handleToggleFav = (e, itemId) => { e.stopPropagation(); setFavs(toggleFavorite(favType, itemId)); };

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

  useEffect(() => {
    if (!selectedCategory || !api) return;
    let cancelled = false;
    const fetchItems = async () => {
      setItemsLoading(true);
      const items = isVod ? await api.getVodStreams(selectedCategory) : await api.getSeries(selectedCategory);
      if (!cancelled && items && Array.isArray(items)) setAllItems(items);
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

  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(0);
  const gridRef = useRef(null);
  useEffect(() => { setCurrentPage(0); }, [selectedCategory, searchQuery]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visibleItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const goToPage = (page) => { setCurrentPage(page); if (gridRef.current) gridRef.current.scrollTop = 0; };

  const handleSeriesClick = async (item) => {
    if (isVod) return;
    setSelectedSeries(item);
    setSeriesLoading(true);
    if (api) {
      const info = await api.getSeriesInfo(item.series_id);
      if (info) setSeriesInfo(info);
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
            {!seriesLoading && seasons.length > 0 && (
              <>
                <div className="season-tabs">
                  {seasons.map(season => (
                    <button key={season} className={`season-tab ${(currentSeason === season) ? 'active' : ''}`}
                      onClick={() => { setActiveSeason(season); setEpPage(0); }}>
                      Season {season}
                      <span className="season-tab-count">{seriesInfo.episodes[season].length}</span>
                    </button>
                  ))}
                </div>
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
        {playingItem && api && (
          <VideoPlayer url={api.getSeriesUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')} title={playingItem.name || playingItem.title} onClose={() => setPlayingItem(null)} />
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
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="section-media-grid" ref={gridRef}>
          {(loading || itemsLoading) && <div className="loading-indicator">Loading {title.toLowerCase()}...</div>}
          {!loading && !itemsLoading && visibleItems.map(item => {
            const posterUrl = item.stream_icon || item.cover || '';
            const itemName = item.name || item.title || '?';
            const itemId = item.stream_id || item.series_id;
            const catName = categories.find(c => String(c.category_id) === String(item.category_id))?.category_name || '';
            return (
              <div key={itemId} className="media-card" onClick={() => {
                if (isVod) { setPlayingItem(item); addToHistory({ id: `vod_${item.stream_id}`, name: item.name, type: 'vod', streamId: item.stream_id, icon: posterUrl }); }
                else handleSeriesClick(item);
              }}>
                <div className="media-poster" style={posterUrl ? { backgroundImage: `url(${posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center top' } : {}}>
                  {!posterUrl && <span className="media-poster-letter">{itemName.charAt(0)}</span>}
                </div>
                {item.rating && item.rating !== '0' && String(item.rating) !== '0' && <div className="media-card-rating">&#9733; {item.rating}</div>}
                <button className={`media-fav-btn ${favs.includes(itemId) ? 'active' : ''}`} onClick={(e) => handleToggleFav(e, itemId)}>&#9733;</button>
                <div className="media-play-overlay">&#9654;</div>
                <div className="media-caption">
                  <div className="media-caption-inner">
                    <div className="media-caption-lines" />
                    <div className="media-card-title">{itemName}</div>
                    {catName && <span className="media-card-category">{catName}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && !itemsLoading && filtered.length > 0 && (
            <div className="media-pagination" style={{gridColumn: '1 / -1'}}>
              <button className="media-page-btn" disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)}>&#8592; Prev</button>
              <div className="media-page-numbers">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page;
                  if (totalPages <= 7) page = i;
                  else if (currentPage < 4) page = i;
                  else if (currentPage >= totalPages - 4) page = totalPages - 7 + i;
                  else page = currentPage - 3 + i;
                  return (
                    <button key={page} className={`media-page-num ${currentPage === page ? 'active' : ''}`} onClick={() => goToPage(page)}>{page + 1}</button>
                  );
                })}
              </div>
              <button className="media-page-btn" disabled={currentPage >= totalPages - 1} onClick={() => goToPage(currentPage + 1)}>Next &#8594;</button>
              <span className="media-page-info">{filtered.length} titles</span>
            </div>
          )}
        </div>
      </div>
      {playingItem && api && (
        <VideoPlayer url={playingItem.isSeries ? api.getSeriesUrl(playingItem.stream_id, playingItem.container_extension || 'mp4') : api.getVodUrl(playingItem.stream_id, playingItem.container_extension || 'mp4')} title={playingItem.name || playingItem.title} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}

/* ══════ RADIO SCREEN ══════ */
function RadioScreen({ onBack }) {
  const radioCategories = [
    { id: 'all', name: 'All Stations' }, { id: 'pop', name: 'Pop' }, { id: 'rock', name: 'Rock' },
    { id: 'jazz', name: 'Jazz' }, { id: 'classical', name: 'Classical' }, { id: 'hiphop', name: 'Hip Hop' },
    { id: 'electronic', name: 'Electronic' }, { id: 'country', name: 'Country' }, { id: 'news', name: 'News & Talk' },
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
        <div className="section-header-right"><span className="channel-count">{filtered.length} stations</span></div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search"><input placeholder="Search stations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="sidebar-categories">
            {radioCategories.map(cat => (
              <div key={cat.id} className={`sidebar-cat-item ${selectedCat === cat.id ? 'active' : ''}`} onClick={() => setSelectedCat(cat.id)}>
                <span>{cat.name}</span>
                <span className="sidebar-cat-count">{cat.id === 'all' ? radioStations.length : radioStations.filter(s => s.cat === cat.id).length}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="radio-grid">
          {filtered.map(station => (
            <div key={station.id} className={`radio-card ${playing?.id === station.id ? 'playing' : ''}`} onClick={() => setPlaying(station)}>
              <div className="radio-icon">&#127911;</div>
              <div className="radio-info"><div className="radio-name">{station.name}</div><div className="radio-genre">{station.genre}</div></div>
              {playing?.id === station.id && <div className="radio-playing-indicator"><span className="radio-bar"></span><span className="radio-bar"></span><span className="radio-bar"></span></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════ SETTINGS SCREEN ══════ */
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
  const [accountInfo, setAccountInfo] = useState({ status: 'Active', expDate: 'Unlimited', maxConnections: 1, activeCons: 0, username: 'N/A', createdAt: 'N/A', isTrial: false });
  const [vpnEnabled, setVpnEnabled] = useState(() => localStorage.getItem('dash_vpn_enabled') === 'true');
  const [vpnProtocol, setVpnProtocol] = useState(() => localStorage.getItem('dash_vpn_protocol') || 'openvpn');
  const [vpnServer, setVpnServer] = useState(() => localStorage.getItem('dash_vpn_server') || '');
  const [vpnPort, setVpnPort] = useState(() => localStorage.getItem('dash_vpn_port') || '');
  const [vpnUsername, setVpnUsername] = useState(() => localStorage.getItem('dash_vpn_username') || '');
  const [vpnPassword, setVpnPassword] = useState(() => localStorage.getItem('dash_vpn_password') || '');
  const [vpnMsg, setVpnMsg] = useState('');

  useEffect(() => {
    if (api) {
      api.authenticate().then(data => {
        if (data && data.user_info) {
          const u = data.user_info;
          const expDate = u.exp_date || 'Unlimited';
          setAccountInfo({
            status: u.status || 'Active',
            expDate: expDate === '' || expDate === '0' ? 'Unlimited' : expDate,
            maxConnections: u.max_connections || 1, activeCons: u.active_cons || 0,
            username: u.username || 'N/A', createdAt: u.created_at || 'N/A',
            isTrial: u.is_trial === '1' || u.is_trial === 1,
          });
        }
      });
    }
  }, [api]);

  const handleSetPin = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinMsg('PIN must be exactly 4 digits'); return; }
    if (newPin !== confirmPin) { setPinMsg('PINs do not match'); return; }
    localStorage.setItem('dash_pin', newPin);
    localStorage.setItem('dash_pin_enabled', 'true');
    setPin(newPin); setPinEnabled(true); setNewPin(''); setConfirmPin('');
    setPinMsg('PIN set successfully!');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const handleDisablePin = () => {
    localStorage.removeItem('dash_pin');
    localStorage.setItem('dash_pin_enabled', 'false');
    setPin(''); setPinEnabled(false);
    setPinMsg('PIN protection disabled');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const handleVpnSave = () => {
    localStorage.setItem('dash_vpn_enabled', vpnEnabled.toString());
    localStorage.setItem('dash_vpn_protocol', vpnProtocol);
    localStorage.setItem('dash_vpn_server', vpnServer);
    localStorage.setItem('dash_vpn_port', vpnPort);
    localStorage.setItem('dash_vpn_username', vpnUsername);
    localStorage.setItem('dash_vpn_password', vpnPassword);
    setVpnMsg('VPN settings saved successfully!');
    setTimeout(() => setVpnMsg(''), 3000);
  };

  const handleResetDeviceKey = () => {
    const newKey = Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
    const newDevice = { ...device, key: newKey };
    localStorage.setItem('dash_device', JSON.stringify(newDevice));
    setDevice(newDevice); setShowResetConfirm(false);
    setResetMsg('Device Key has been reset. You will need to re-activate this device.');
    setTimeout(() => setResetMsg(''), 5000);
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: '\u{1F464}' },
    { id: 'parental', label: 'Parental Control', icon: '\u{1F512}' },
    { id: 'vpn', label: 'VPN', icon: '\u{1F6E1}' },
    { id: 'device', label: 'Device Info', icon: '\u{1F4F1}' },
    { id: 'about', label: 'About', icon: '\u{2139}' },
  ];

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Settings</h1>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-categories" style={{ paddingTop: 12 }}>
            {tabs.map(tab => (
              <div key={tab.id} className={`sidebar-cat-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.icon} {tab.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="settings-content">
          {activeTab === 'account' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">Account Information</h3>
                <p className="settings-card-desc">Your Xtream Codes subscription details.</p>
                <div className="settings-account-grid">
                  <div className="settings-account-item">
                    <div className="settings-account-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>&#10003;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">Status</span><span className="settings-account-value" style={{ color: '#10b981' }}>{accountInfo.status.toUpperCase()}</span></div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128197;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">Expires</span><span className="settings-account-value">{accountInfo.expDate}</span></div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128279;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">Max Connections</span><span className="settings-account-value">{accountInfo.maxConnections}</span></div>
                  </div>
                  <div className="settings-account-item">
                    <div className="settings-account-icon">&#128101;</div>
                    <div className="settings-account-detail"><span className="settings-account-label">Active</span><span className="settings-account-value">{accountInfo.activeCons} / {accountInfo.maxConnections}</span></div>
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">Subscription Details</h3>
                <div className="settings-device-info">
                  <div className="settings-device-row"><span className="settings-device-label">Username</span><span className="settings-device-value">{accountInfo.username}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">Created</span><span className="settings-device-value">{accountInfo.createdAt}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">Trial</span><span className="settings-device-value">{accountInfo.isTrial ? 'Yes' : 'No'}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">User Agent</span><span className="settings-device-value">DashPlayer/1.0</span></div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'parental' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">Adult Content PIN Lock</h3>
                <p className="settings-card-desc">Set a 4-digit PIN to protect adult channels.</p>
                <div className="settings-status"><span>Status:</span><span className={`settings-badge ${pinEnabled ? 'active' : 'inactive'}`}>{pinEnabled ? 'ENABLED' : 'DISABLED'}</span></div>
                {pinEnabled ? (
                  <div className="settings-pin-section">
                    <p className="settings-pin-info">PIN is currently set. You can change or disable it.</p>
                    <div className="settings-pin-row">
                      <input type="password" maxLength={4} placeholder="New PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <input type="password" maxLength={4} placeholder="Confirm" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <button className="settings-btn settings-btn-primary" onClick={handleSetPin}>Change PIN</button>
                    </div>
                    <button className="settings-btn settings-btn-danger" onClick={handleDisablePin}>Disable PIN</button>
                  </div>
                ) : (
                  <div className="settings-pin-section">
                    <div className="settings-pin-row">
                      <input type="password" maxLength={4} placeholder="4-digit PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <input type="password" maxLength={4} placeholder="Confirm" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="settings-pin-input" />
                      <button className="settings-btn settings-btn-primary" onClick={handleSetPin}>Set PIN</button>
                    </div>
                  </div>
                )}
                {pinMsg && <p className={`settings-msg ${pinMsg.includes('successfully') ? 'success' : pinMsg.includes('disabled') ? 'info' : 'error'}`}>{pinMsg}</p>}
              </div>
            </div>
          )}
          {activeTab === 'vpn' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">VPN Configuration</h3>
                <p className="settings-card-desc">Configure VPN to secure your connection. Enable VPN and select your preferred protocol.</p>
                <div className="settings-status">
                  <span>VPN Status:</span>
                  <span className={`settings-badge ${vpnEnabled ? 'active' : 'inactive'}`}>
                    {vpnEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Enable VPN</span>
                  <button
                    className={`settings-btn ${vpnEnabled ? 'settings-btn-danger' : 'settings-btn-primary'}`}
                    onClick={() => { setVpnEnabled(!vpnEnabled); }}
                  >
                    {vpnEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">Protocol & Server</h3>
                <p className="settings-card-desc">Choose your VPN protocol and enter server details.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Protocol</label>
                    <select
                      value={vpnProtocol}
                      onChange={e => setVpnProtocol(e.target.value)}
                      className="header-sort-select"
                      style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
                    >
                      <option value="openvpn">OpenVPN (UDP)</option>
                      <option value="openvpn_tcp">OpenVPN (TCP)</option>
                      <option value="wireguard">WireGuard</option>
                      <option value="ikev2">IKEv2/IPSec</option>
                      <option value="l2tp">L2TP/IPSec</option>
                      <option value="pptp">PPTP</option>
                      <option value="shadowsocks">Shadowsocks</option>
                      <option value="softether">SoftEther</option>
                    </select>
                  </div>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Server Address</label>
                    <input
                      type="text"
                      placeholder="e.g., vpn.example.com"
                      value={vpnServer}
                      onChange={e => setVpnServer(e.target.value)}
                      className="quick-connect-input"
                    />
                  </div>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Port</label>
                    <input
                      type="text"
                      placeholder="e.g., 1194"
                      value={vpnPort}
                      onChange={e => setVpnPort(e.target.value)}
                      className="quick-connect-input"
                      style={{ width: 150 }}
                    />
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">Authentication</h3>
                <p className="settings-card-desc">Enter your VPN credentials if required.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Username</label>
                    <input
                      type="text"
                      placeholder="VPN username"
                      value={vpnUsername}
                      onChange={e => setVpnUsername(e.target.value)}
                      className="quick-connect-input"
                    />
                  </div>
                  <div>
                    <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Password</label>
                    <input
                      type="password"
                      placeholder="VPN password"
                      value={vpnPassword}
                      onChange={e => setVpnPassword(e.target.value)}
                      className="quick-connect-input"
                    />
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="settings-btn settings-btn-primary" onClick={handleVpnSave}>Save VPN Settings</button>
                </div>
                {vpnMsg && <p className="settings-msg success">{vpnMsg}</p>}
              </div>
            </div>
          )}
          {activeTab === 'device' && (
            <div className="settings-panel">
              <div className="settings-card">
                <h3 className="settings-card-title">Device Information</h3>
                <div className="settings-device-info">
                  <div className="settings-device-row"><span className="settings-device-label">MAC Address</span><span className="settings-device-value">{device.mac}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">Device Key</span><span className="settings-device-value">{device.key}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">App Version</span><span className="settings-device-value">2.0.0</span></div>
                </div>
              </div>
              <div className="settings-card">
                <h3 className="settings-card-title">Reset Device Key</h3>
                <p className="settings-card-desc">Generate a new device key. This will deactivate the current device.</p>
                {!showResetConfirm ? (
                  <button className="settings-btn settings-btn-danger" onClick={() => setShowResetConfirm(true)}>Reset Device Key</button>
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
                <p className="settings-about-version">Version 2.0.0</p>
                <p className="settings-card-desc" style={{ marginTop: 16 }}>Multi-platform IPTV player with Xtream Codes support. Live TV, Movies, Series, Radio, EPG, Catch Up, Multi-Screen.</p>
                <div className="settings-about-links"><span>Support: dashplayer.eu</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════ PLAYLISTS SCREEN ══════ */
function PlaylistsScreen({ onBack, onSwitch, activePlaylist }) {
  const [playlists, setPlaylists] = useState(() => getPlaylists());
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [m3uInput, setM3uInput] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pinPrompt, setPinPrompt] = useState(null); // { playlistId, pin, error }
  const [pinSetup, setPinSetup] = useState(null); // { playlistId, pin }

  const parseM3uUrl = (url) => {
    try {
      const u = new URL(url);
      const user = u.searchParams.get('username');
      const pass = u.searchParams.get('password');
      if (user && pass) return { url: `${u.protocol}//${u.host}`, username: user, password: pass };
    } catch {}
    return null;
  };

  const handleM3uPaste = (val) => {
    setM3uInput(val);
    const parsed = parseM3uUrl(val.trim());
    if (parsed) {
      setServerUrl(parsed.url);
      setUsername(parsed.username);
      setPassword(parsed.password);
    }
  };

  const resetForm = () => {
    setName(''); setServerUrl(''); setUsername(''); setPassword(''); setM3uInput('');
    setShowAdd(false); setEditId(null);
  };

  const handleSave = () => {
    if (!serverUrl || !username || !password) {
      setMsg('Server URL, username, and password are required');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    let updated;
    if (editId !== null) {
      updated = playlists.map(p => p.id === editId ? { ...p, name: name || 'My Playlist', server_url: serverUrl, username, password } : p);
    } else {
      const newId = Date.now();
      const isDefault = playlists.length === 0 ? true : false;
      updated = [...playlists, { id: newId, name: name || 'My Playlist', server_url: serverUrl, username, password, is_default: isDefault }];
    }
    savePlaylists(updated);
    setPlaylists(updated);
    resetForm();
    setMsg(editId !== null ? 'Playlist updated!' : 'Playlist added!');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleEdit = (pl) => {
    setEditId(pl.id);
    setName(pl.name);
    setServerUrl(pl.server_url);
    setUsername(pl.username);
    setPassword(pl.password);
    setShowAdd(true);
  };

  const handleDelete = (id) => {
    let updated = playlists.filter(p => p.id !== id);
    if (updated.length > 0 && !updated.find(p => p.is_default)) {
      updated[0].is_default = true;
    }
    savePlaylists(updated);
    setPlaylists(updated);
    setConfirmDelete(null);
    setMsg('Playlist deleted');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSetDefault = (id) => {
    const updated = playlists.map(p => ({ ...p, is_default: p.id === id }));
    savePlaylists(updated);
    setPlaylists(updated);
    const pl = updated.find(p => p.id === id);
    if (pl && onSwitch) onSwitch({ url: pl.server_url, username: pl.username, password: pl.password });
    setMsg('Default playlist changed');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSwitchTo = (pl) => {
    if (pl.pin) {
      setPinPrompt({ playlistId: pl.id, pin: '', error: '' });
    } else {
      if (onSwitch) onSwitch({ url: pl.server_url, username: pl.username, password: pl.password });
    }
  };

  const handlePinSubmit = () => {
    if (!pinPrompt) return;
    const pl = playlists.find(p => p.id === pinPrompt.playlistId);
    if (!pl) return;
    if (pinPrompt.pin === pl.pin) {
      setPinPrompt(null);
      if (onSwitch) onSwitch({ url: pl.server_url, username: pl.username, password: pl.password });
    } else {
      setPinPrompt({ ...pinPrompt, error: 'Incorrect PIN. Please try again.' });
    }
  };

  const handleSetPin = (playlistId) => {
    setPinSetup({ playlistId, pin: '' });
  };

  const handleSavePin = () => {
    if (!pinSetup || pinSetup.pin.length !== 4) {
      return;
    }
    const updated = playlists.map(p => p.id === pinSetup.playlistId ? { ...p, pin: pinSetup.pin } : p);
    savePlaylists(updated);
    setPlaylists(updated);
    setPinSetup(null);
    setMsg('PIN set successfully');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRemovePin = (playlistId) => {
    const updated = playlists.map(p => p.id === playlistId ? { ...p, pin: '' } : p);
    savePlaylists(updated);
    setPlaylists(updated);
    setMsg('PIN removed');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Playlists</h1>
        <button className="settings-btn settings-btn-primary" onClick={() => { resetForm(); setShowAdd(true); }} style={{ marginLeft: 'auto' }}>
          + Add Playlist
        </button>
      </div>
      <div className="playlists-content" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        {msg && <div className="settings-msg success" style={{ marginBottom: 16 }}>{msg}</div>}

        {showAdd && (
          <div className="settings-card" style={{ marginBottom: 20 }}>
            <h3 className="settings-card-title">{editId !== null ? 'Edit Playlist' : 'Add New Playlist'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Paste M3U URL (optional)</label>
                <input className="quick-connect-input" placeholder="http://server:port/get.php?username=...&password=..." value={m3uInput} onChange={e => handleM3uPaste(e.target.value)} />
              </div>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Playlist Name</label>
                <input className="quick-connect-input" placeholder="My Playlist" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Server URL</label>
                <input className="quick-connect-input" placeholder="http://server:port" value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Username</label>
                  <input className="quick-connect-input" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="settings-device-label" style={{ display: 'block', marginBottom: 6 }}>Password</label>
                  <input className="quick-connect-input" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="settings-btn settings-btn-primary" onClick={handleSave}>{editId !== null ? 'Update' : 'Add Playlist'}</button>
                <button className="settings-btn settings-btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {playlists.length === 0 && !showAdd && (
          <div className="settings-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128220;</div>
            <h3 className="settings-card-title">No Playlists Yet</h3>
            <p className="settings-card-desc">Add your first IPTV playlist to get started.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {playlists.map(pl => {
            const isActive = activePlaylist && activePlaylist.url === pl.server_url && activePlaylist.username === pl.username;
            const isProtected = !!pl.pin;
            return (
              <div key={pl.id} className="settings-card" style={{ position: 'relative', border: pl.is_default ? '2px solid #8b5cf6' : undefined }}>
                {pl.is_default && (
                  <span style={{ position: 'absolute', top: 10, right: 12, background: '#8b5cf6', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>DEFAULT</span>
                )}
                {isActive && !pl.is_default && (
                  <span style={{ position: 'absolute', top: 10, right: 12, background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>ACTIVE</span>
                )}
                {isProtected && (
                  <span style={{ position: 'absolute', top: pl.is_default || (isActive && !pl.is_default) ? 34 : 10, right: 12, background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>&#128274; Protected</span>
                )}
                <h3 className="settings-card-title" style={{ marginBottom: 8 }}>{isProtected ? '🔒 ' : ''}{pl.name || 'My Playlist'}</h3>
                <div className="settings-device-info" style={{ marginBottom: 12 }}>
                  <div className="settings-device-row"><span className="settings-device-label">Server</span><span className="settings-device-value" style={{ wordBreak: 'break-all' }}>{pl.server_url}</span></div>
                  <div className="settings-device-row"><span className="settings-device-label">Username</span><span className="settings-device-value">{isProtected ? '*****' : pl.username}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!isActive && (
                    <button className="settings-btn settings-btn-primary" onClick={() => handleSwitchTo(pl)} style={{ fontSize: 12 }}>Switch To</button>
                  )}
                  {!pl.is_default && (
                    <button className="settings-btn settings-btn-secondary" onClick={() => handleSetDefault(pl.id)} style={{ fontSize: 12 }}>Set Default</button>
                  )}
                  <button className="settings-btn settings-btn-secondary" onClick={() => handleEdit(pl)} style={{ fontSize: 12 }}>Edit</button>
                  {isProtected ? (
                    <button className="settings-btn settings-btn-secondary" onClick={() => handleRemovePin(pl.id)} style={{ fontSize: 12 }}>Remove PIN</button>
                  ) : (
                    <button className="settings-btn settings-btn-secondary" onClick={() => handleSetPin(pl.id)} style={{ fontSize: 12 }}>Set PIN</button>
                  )}
                  {confirmDelete === pl.id ? (
                    <>
                      <button className="settings-btn settings-btn-danger" onClick={() => handleDelete(pl.id)} style={{ fontSize: 12 }}>Confirm</button>
                      <button className="settings-btn settings-btn-secondary" onClick={() => setConfirmDelete(null)} style={{ fontSize: 12 }}>Cancel</button>
                    </>
                  ) : (
                    <button className="settings-btn settings-btn-danger" onClick={() => setConfirmDelete(pl.id)} style={{ fontSize: 12 }}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIN Setup Dialog */}
      {pinSetup && (
        <div className="pin-overlay" onClick={() => setPinSetup(null)}>
          <div className="pin-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#128274;</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text)' }}>Set PIN</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>Enter a 4-digit PIN to protect this playlist</p>
            <input
              className="pin-input"
              type="tel"
              maxLength={4}
              placeholder="0000"
              value={pinSetup.pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPinSetup({ ...pinSetup, pin: val });
              }}
              onKeyDown={e => { if (e.key === 'Enter' && pinSetup.pin.length === 4) handleSavePin(); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="settings-btn settings-btn-primary" onClick={handleSavePin} disabled={pinSetup.pin.length !== 4}>Save PIN</button>
              <button className="settings-btn settings-btn-secondary" onClick={() => setPinSetup(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Prompt Dialog */}
      {pinPrompt && (
        <div className="pin-overlay" onClick={() => setPinPrompt(null)}>
          <div className="pin-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>&#128274;</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text)' }}>Enter PIN</h3>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>This playlist is PIN protected</p>
            <input
              className="pin-input"
              type="tel"
              maxLength={4}
              placeholder="0000"
              value={pinPrompt.pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPinPrompt({ ...pinPrompt, pin: val, error: '' });
              }}
              onKeyDown={e => { if (e.key === 'Enter' && pinPrompt.pin.length === 4) handlePinSubmit(); }}
              autoFocus
            />
            {pinPrompt.error && <div className="pin-error">{pinPrompt.error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="settings-btn settings-btn-primary" onClick={handlePinSubmit} disabled={pinPrompt.pin.length !== 4}>Unlock</button>
              <button className="settings-btn settings-btn-secondary" onClick={() => setPinPrompt(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ SPEED TEST SCREEN ══════ */
function SpeedTestScreen({ onBack }) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const runSpeedTest = async () => {
    setTesting(true); setResults(null); setProgress(0); setError('');
    try {
      // Ping test
      const pingStart = performance.now();
      await fetch('https://speed.cloudflare.com/__down?bytes=1000', { cache: 'no-store' });
      const ping = Math.round(performance.now() - pingStart);
      setProgress(20);

      // Download test (10MB)
      const dlStart = performance.now();
      const response = await fetch('https://speed.cloudflare.com/__down?bytes=10000000', { cache: 'no-store' });
      const reader = response.body.getReader();
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        setProgress(20 + Math.round((received / 10000000) * 70));
      }
      const dlTime = (performance.now() - dlStart) / 1000;
      const dlSpeed = ((received * 8) / dlTime / 1000000).toFixed(2);
      setProgress(100);

      setResults({ ping, download: dlSpeed, bytes: received });
    } catch (e) {
      setError('Speed test failed: ' + e.message);
    }
    setTesting(false);
  };

  const formatBytes = (bytes) => {
    if (bytes >= 1000000) return (bytes / 1000000).toFixed(1) + ' MB';
    if (bytes >= 1000) return (bytes / 1000).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Speed Test</h1>
      </div>
      <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, overflowY: 'auto', flex: 1 }}>
        {/* Gauge area */}
        <div className="speedtest-gauge">
          <svg viewBox="0 0 200 120" width="280" height="168">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 251.3} 251.3`} style={{ transition: 'stroke-dasharray 0.3s ease' }} />
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="speedtest-gauge-value">
            {testing ? `${progress}%` : results ? `${results.download}` : '0'}
          </div>
          <div className="speedtest-gauge-unit">
            {testing ? 'Testing...' : results ? 'Mbps' : 'Mbps'}
          </div>
        </div>

        {/* Start button */}
        {!testing && !results && (
          <button className="settings-btn settings-btn-primary speedtest-start-btn" onClick={runSpeedTest}>
            &#128640; Start Test
          </button>
        )}

        {/* Progress animation */}
        {testing && (
          <div className="speedtest-progress-bar">
            <div className="speedtest-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Error */}
        {error && <div className="settings-msg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

        {/* Results */}
        {results && (
          <div className="speedtest-results">
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#128640;</div>
              <div className="speedtest-result-value">{results.download}</div>
              <div className="speedtest-result-label">Download (Mbps)</div>
            </div>
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#9201;</div>
              <div className="speedtest-result-value">{results.ping}</div>
              <div className="speedtest-result-label">Ping (ms)</div>
            </div>
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#128230;</div>
              <div className="speedtest-result-value">{formatBytes(results.bytes)}</div>
              <div className="speedtest-result-label">Data Downloaded</div>
            </div>
            <div className="speedtest-result-card">
              <div className="speedtest-result-icon">&#9989;</div>
              <div className="speedtest-result-value" style={{ color: '#10b981' }}>Connected</div>
              <div className="speedtest-result-label">Status</div>
            </div>
          </div>
        )}

        {/* Retest */}
        {results && (
          <button className="settings-btn settings-btn-secondary" onClick={runSpeedTest}>
            &#128260; Test Again
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════ TRIAL EXPIRED SCREEN ══════ */
function TrialExpiredScreen() {
  const [device] = useState(() => getDeviceIdentity());
  const panelUrl = 'https://dashplayer.eu';
  return (
    <div className="activation-screen">
      <div className="activation-container">
        <div className="activation-info">
          <div className="activation-info-inner">
            <div className="trial-expired-icon">&#9888;</div>
            <h2 className="trial-expired-title">Your Trial Has Ended</h2>
            <p className="trial-expired-desc">Your free trial period has expired. Please activate your device.</p>
            <a href={panelUrl} className="activation-url">{panelUrl}</a>
            <div className="activation-field">
              <label className="activation-label">Mac Address</label>
              <div className="activation-value-row"><span className="activation-value">{device.mac}</span></div>
            </div>
            <div className="activation-field">
              <label className="activation-label">Device Key</label>
              <div className="activation-value-row"><span className="activation-value">{device.key}</span></div>
            </div>
          </div>
        </div>
        <div className="activation-brand">
          <div className="activation-logo">D</div>
          <div className="activation-app-name">Dash Player</div>
          <p className="activation-qr-text">Scan to activate</p>
        </div>
      </div>
    </div>
  );
}

/* ══════ FAVORITES SCREEN ══════ */
function FavoritesScreen({ onBack, api, onNavigate }) {
  const [activeTab, setActiveTab] = useState('live');
  const [playingItem, setPlayingItem] = useState(null);
  const [groups, setGroups] = useState(() => getCustomGroups());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editGroupId, setEditGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);
  const [liveChannels, setLiveChannels] = useState([]);
  const [vodItems, setVodItems] = useState([]);
  const [seriesItems, setSeriesItems] = useState([]);
  const [loadedFavs, setLoadedFavs] = useState(false);
  const history = getWatchHistory();

  const liveFavs = getFavorites('live');
  const vodFavs = getFavorites('vod');
  const seriesFavs = getFavorites('series');

  // Load favorite items from API
  useEffect(() => {
    if (!api || loadedFavs) return;
    const load = async () => {
      if (liveFavs.length > 0) {
        const all = await api.getLiveStreams();
        if (all && Array.isArray(all)) setLiveChannels(all.filter(ch => liveFavs.includes(ch.stream_id || ch.num)));
      }
      if (vodFavs.length > 0) {
        const all = await api.getVodStreams();
        if (all && Array.isArray(all)) setVodItems(all.filter(v => vodFavs.includes(v.stream_id || v.num)));
      }
      if (seriesFavs.length > 0) {
        const all = await api.getSeries();
        if (all && Array.isArray(all)) setSeriesItems(all.filter(s => seriesFavs.includes(s.series_id)));
      }
      setLoadedFavs(true);
    };
    load();
  }, [api, loadedFavs]);

  const tabs = [
    { id: 'live', label: 'Live TV', icon: '\u{1F4FA}' },
    { id: 'vod', label: 'Movies', icon: '\u{1F3AC}' },
    { id: 'series', label: 'Series', icon: '\u{1F3A5}' },
    { id: 'history', label: 'Recently Watched', icon: '\u{1F554}' },
    { id: 'groups', label: 'Custom Groups', icon: '\u{1F4C1}' },
  ];

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = { id: Date.now(), name: newGroupName.trim(), channels: [] };
    const updated = [...groups, newGroup];
    saveCustomGroups(updated);
    setGroups(updated);
    setNewGroupName('');
    setShowCreateGroup(false);
  };

  const handleRenameGroup = (id) => {
    if (!editGroupName.trim()) return;
    const updated = groups.map(g => g.id === id ? { ...g, name: editGroupName.trim() } : g);
    saveCustomGroups(updated);
    setGroups(updated);
    setEditGroupId(null);
    setEditGroupName('');
  };

  const handleDeleteGroup = (id) => {
    const updated = groups.filter(g => g.id !== id);
    saveCustomGroups(updated);
    setGroups(updated);
    setConfirmDeleteGroup(null);
  };

  const handleRemoveFromGroup = (groupId, channelId) => {
    const updated = groups.map(g => g.id === groupId ? { ...g, channels: g.channels.filter(c => c.id !== channelId) } : g);
    saveCustomGroups(updated);
    setGroups(updated);
  };

  const handleAddToGroup = (groupId, channel) => {
    const updated = groups.map(g => {
      if (g.id !== groupId) return g;
      if (g.channels.find(c => c.id === channel.id)) return g;
      return { ...g, channels: [...g.channels, channel] };
    });
    saveCustomGroups(updated);
    setGroups(updated);
  };

  const [moveTarget, setMoveTarget] = useState(null); // { item, type }

  const renderFavList = (items, type) => {
    if (items.length === 0) return (
      <div className="epg-empty">
        <div style={{ fontSize: 48 }}>{type === 'live' ? '\u{1F4FA}' : type === 'vod' ? '\u{1F3AC}' : '\u{1F3A5}'}</div>
        <p>No {type === 'live' ? 'channel' : type === 'vod' ? 'movie' : 'series'} favorites yet</p>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8 }}>Add favorites from the {type === 'live' ? 'Live TV' : type === 'vod' ? 'Movies' : 'Series'} section</p>
      </div>
    );
    return (
      <div className="history-list">
        {items.map(item => {
          const itemId = type === 'series' ? item.series_id : (item.stream_id || item.num);
          const itemName = item.name || item.title || 'Unknown';
          const icon = item.stream_icon || item.cover || '';
          return (
            <div key={itemId} className="history-item">
              {icon ? <img className="history-icon" src={icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="history-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{type === 'live' ? '\u{1F4FA}' : '\u{1F3AC}'}</div>}
              <div className="history-info" onClick={() => {
                if (type === 'live' && api) { setPlayingItem({ url: api.getLiveUrl(itemId, 'ts'), name: itemName }); addToHistory({ id: itemId, name: itemName, icon, type: 'live', streamId: itemId }); }
                else if (type === 'vod' && api) { setPlayingItem({ url: api.getVodUrl(itemId, 'mp4'), name: itemName }); addToHistory({ id: itemId, name: itemName, icon, type: 'vod', streamId: itemId }); }
              }} style={{ cursor: 'pointer', flex: 1 }}>
                <div className="history-name">{itemName}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {groups.length > 0 && (
                  moveTarget && moveTarget.id === itemId ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {groups.map(g => (
                        <button key={g.id} className="settings-btn settings-btn-secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => { handleAddToGroup(g.id, { id: itemId, name: itemName, icon, type }); setMoveTarget(null); }}>{g.name}</button>
                      ))}
                      <button className="settings-btn settings-btn-secondary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setMoveTarget(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="settings-btn settings-btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setMoveTarget({ id: itemId, name: itemName, icon, type })} title="Add to group">{'\u{1F4C1}'}</button>
                  )
                )}
                <button className="settings-btn settings-btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => { toggleFavorite(type, itemId); setLoadedFavs(false); }} title="Remove">&times;</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
              <div key={tab.id} className={`sidebar-cat-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.icon} {tab.label}</span>
                <span className="sidebar-cat-count">
                  {tab.id === 'live' ? liveFavs.length : tab.id === 'vod' ? vodFavs.length : tab.id === 'series' ? seriesFavs.length : tab.id === 'history' ? history.length : groups.length}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="favorites-content" style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'live' && renderFavList(liveChannels, 'live')}
          {activeTab === 'vod' && renderFavList(vodItems, 'vod')}
          {activeTab === 'series' && renderFavList(seriesItems, 'series')}
          {activeTab === 'history' && (
            history.length === 0 ? (
              <div className="epg-empty"><div style={{ fontSize: 48 }}>{'\u{1F554}'}</div><p>No watch history yet</p></div>
            ) : (
              <div className="history-list">
                {history.map(item => (
                  <div key={item.id} className="history-item" onClick={() => {
                    if (item.type === 'live' && api) setPlayingItem({ url: api.getLiveUrl(item.streamId, 'ts'), name: item.name });
                    else if (item.type === 'vod' && api) setPlayingItem({ url: api.getVodUrl(item.streamId, 'mp4'), name: item.name });
                  }}>
                    {item.icon ? <img className="history-icon" src={item.icon} alt="" onError={e => e.target.style.display='none'} /> : null}
                    <div className="history-info"><div className="history-name">{item.name}</div><div className="history-meta">{item.type === 'live' ? 'Live TV' : item.type === 'vod' ? 'Movie' : 'Series'} - {new Date(item.watchedAt).toLocaleDateString()}</div></div>
                    <span className="ep-play">&#9654;</span>
                  </div>
                ))}
              </div>
            )
          )}
          {activeTab === 'groups' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Custom Groups</h3>
                <button className="settings-btn settings-btn-primary" onClick={() => setShowCreateGroup(true)} style={{ fontSize: 12 }}>+ New Group</button>
              </div>
              {showCreateGroup && (
                <div className="settings-card" style={{ marginBottom: 16, padding: 16 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input className="quick-connect-input" placeholder="Group name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
                    <button className="settings-btn settings-btn-primary" onClick={handleCreateGroup} style={{ fontSize: 12 }}>Create</button>
                    <button className="settings-btn settings-btn-secondary" onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }} style={{ fontSize: 12 }}>Cancel</button>
                  </div>
                </div>
              )}
              {groups.length === 0 && !showCreateGroup && (
                <div className="epg-empty">
                  <div style={{ fontSize: 48 }}>{'\u{1F4C1}'}</div>
                  <p>No custom groups yet</p>
                  <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8 }}>Create groups and add your favorite channels to organize them</p>
                </div>
              )}
              {groups.map(group => (
                <div key={group.id} className="settings-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    {editGroupId === group.id ? (
                      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        <input className="quick-connect-input" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleRenameGroup(group.id)} />
                        <button className="settings-btn settings-btn-primary" onClick={() => handleRenameGroup(group.id)} style={{ fontSize: 11 }}>Save</button>
                        <button className="settings-btn settings-btn-secondary" onClick={() => setEditGroupId(null)} style={{ fontSize: 11 }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <h3 className="settings-card-title" style={{ margin: 0 }}>{'\u{1F4C1}'} {group.name} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({group.channels.length})</span></h3>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="settings-btn settings-btn-secondary" onClick={() => { setEditGroupId(group.id); setEditGroupName(group.name); }} style={{ fontSize: 11 }}>Rename</button>
                          {confirmDeleteGroup === group.id ? (
                            <>
                              <button className="settings-btn settings-btn-danger" onClick={() => handleDeleteGroup(group.id)} style={{ fontSize: 11 }}>Confirm</button>
                              <button className="settings-btn settings-btn-secondary" onClick={() => setConfirmDeleteGroup(null)} style={{ fontSize: 11 }}>Cancel</button>
                            </>
                          ) : (
                            <button className="settings-btn settings-btn-danger" onClick={() => setConfirmDeleteGroup(group.id)} style={{ fontSize: 11 }}>Delete</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {group.channels.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No channels in this group. Add from the Live TV, Movies, or Series tabs.</p>
                  ) : (
                    <div className="history-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {group.channels.map(ch => (
                        <div key={ch.id} className="history-item">
                          {ch.icon ? <img className="history-icon" src={ch.icon} alt="" onError={e => e.target.style.display='none'} /> : <div className="history-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{ch.type === 'live' ? '\u{1F4FA}' : '\u{1F3AC}'}</div>}
                          <div className="history-info" onClick={() => {
                            if (ch.type === 'live' && api) setPlayingItem({ url: api.getLiveUrl(ch.id, 'ts'), name: ch.name });
                            else if (ch.type === 'vod' && api) setPlayingItem({ url: api.getVodUrl(ch.id, 'mp4'), name: ch.name });
                          }} style={{ cursor: 'pointer', flex: 1 }}>
                            <div className="history-name">{ch.name}</div>
                            <div className="history-meta" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ch.type === 'live' ? 'Live TV' : ch.type === 'vod' ? 'Movie' : 'Series'}</div>
                          </div>
                          <button className="settings-btn settings-btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => handleRemoveFromGroup(group.id, ch.id)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {playingItem && <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />}
    </div>
  );
}

/* ══════ CATCH UP SCREEN (with timeshift playback) ══════ */
function CatchUpScreen({ onBack, api }) {
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingItem, setPlayingItem] = useState(null);

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
        setChannels(streams.filter(s => s.tv_archive === 1 || s.tv_archive === '1'));
      }
      if (!cancelled) setChannelLoading(false);
    };
    fetchStreams();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  // Fetch EPG for selected catch-up channel
  useEffect(() => {
    if (!selectedChannel || !api) return;
    api.getEPG(selectedChannel.stream_id).then(data => {
      if (data && data.epg_listings && data.epg_listings.length > 0) {
        setEpgData(data.epg_listings.map((e, i) => ({
          id: e.id || i,
          title: e.title ? b64decode(e.title) : 'No Title',
          description: e.description ? b64decode(e.description) : '',
          start: e.start, end: e.end,
          has_archive: e.has_archive || true,
        })));
      } else {
        setEpgData([]);
      }
    });
  }, [selectedChannel, api]);

  const filtered = channels.filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isPastProgram = (p) => new Date(p.end) < new Date();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const playTimeshiftProgram = (prog) => {
    if (!api || !selectedChannel) return;
    // Build timeshift URL
    const startTime = new Date(prog.start);
    const endTime = new Date(prog.end);
    const duration = Math.ceil((endTime - startTime) / 60000); // minutes
    const startStr = startTime.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
    const url = api.getTimeshiftUrl(selectedChannel.stream_id, startStr, duration);
    setPlayingItem({ url, name: `${prog.title} (Catch Up)` });
  };

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Catch Up TV</h1>
        <div className="section-header-right"><span className="channel-count">{filtered.length} channels with catch-up</span></div>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-search"><input placeholder="Search catch-up..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="section-channel-list" style={{maxWidth: selectedChannel ? '300px' : undefined}}>
          {(loading || channelLoading) && <div className="loading-indicator">Loading catch-up channels...</div>}
          {!loading && !channelLoading && filtered.length === 0 && (
            <div className="epg-empty"><div style={{ fontSize: 48 }}>&#9202;</div><p>No catch-up channels in this category</p></div>
          )}
          {!loading && !channelLoading && filtered.map(ch => (
            <div key={ch.stream_id} className={`ch-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
              onClick={() => setSelectedChannel(ch)}>
              {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : null}
              <div className="ch-icon" style={ch.stream_icon ? { display: 'none' } : {}}>{(ch.name || '?').charAt(0)}</div>
              <div className="ch-info">
                <div className="ch-name">{ch.name}</div>
                <div className="ch-prog">Archive: {ch.tv_archive_duration || '?'} days</div>
              </div>
            </div>
          ))}
        </div>
        {/* EPG Archive Panel */}
        {selectedChannel && (
          <div className="section-epg">
            <div className="epg-top">
              <div><div className="epg-ch-name">{selectedChannel.name}</div><div className="epg-ch-cat">Catch Up - {selectedChannel.tv_archive_duration || '?'} days archive</div></div>
            </div>
            <div className="epg-programs">
              {epgData.filter(p => isPastProgram(p)).map(prog => (
                <div key={prog.id} className="epg-prog" style={{cursor: 'pointer'}} onClick={() => playTimeshiftProgram(prog)}>
                  <div className="epg-prog-time">
                    <div>{formatDate(prog.start)}</div>
                    <div>{formatTime(prog.start)}</div>
                  </div>
                  <div className="epg-prog-details">
                    <div className="epg-prog-title">{prog.title}</div>
                    <div className="epg-prog-desc">{prog.description}</div>
                  </div>
                  <span className="ep-play" style={{marginLeft: 'auto', flexShrink: 0}}>&#9654;</span>
                </div>
              ))}
              {epgData.filter(p => isPastProgram(p)).length === 0 && (
                <div className="epg-empty"><p>No archived programs available</p></div>
              )}
            </div>
          </div>
        )}
      </div>
      {playingItem && <VideoPlayer url={playingItem.url} title={playingItem.name} onClose={() => setPlayingItem(null)} />}
    </div>
  );
}

/* ══════ SEARCH SCREEN ══════ */
function SearchScreen({ onBack, api }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ live: [], vod: [], series: [] });
  const [searching, setSearching] = useState(false);
  const [playingItem, setPlayingItem] = useState(null);
  const searchTimeout = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2 || !api) { setResults({ live: [], vod: [], series: [] }); return; }
    setSearching(true);
    const [live, vod, series] = await Promise.all([api.getLiveStreams(), api.getVodStreams(), api.getSeries()]);
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
                      <div className="search-result-info"><div className="search-result-name">{item.name}</div><div className="search-result-type">Movie {item.rating && item.rating !== '0' ? `- \u2605 ${item.rating}` : ''}</div></div>
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
                      <div className="search-result-info"><div className="search-result-name">{item.name}</div><div className="search-result-type">Series {item.rating && item.rating !== '0' ? `- \u2605 ${item.rating}` : ''}</div></div>
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

/* ══════ EPG GRID VIEW (TV Guide) ══════ */
function EPGGridScreen({ onBack, api }) {
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [epgByChannel, setEpgByChannel] = useState({});
  const [selectedDate, setSelectedDate] = useState(0); // 0 = today, -1 = yesterday, 1 = tomorrow
  const scrollRef = useRef(null);

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
    const fetch = async () => {
      setLoading(true);
      const streams = await api.getLiveStreams(selectedCategory);
      if (!cancelled && streams && Array.isArray(streams)) {
        const limited = streams.slice(0, 30); // limit to 30 for performance
        setChannels(limited);
        // Fetch EPG for each channel
        const epgMap = {};
        await Promise.all(limited.map(async (ch) => {
          const data = await api.getEPG(ch.stream_id);
          if (data && data.epg_listings) {
            epgMap[ch.stream_id] = data.epg_listings.map((e, i) => ({
              id: e.id || i,
              title: e.title ? b64decode(e.title) : '',
              start: e.start, end: e.end,
            }));
          }
        }));
        if (!cancelled) setEpgByChannel(epgMap);
      }
      if (!cancelled) setLoading(false);
    };
    fetch();
    return () => { cancelled = true; };
  }, [selectedCategory, api]);

  // Generate hours for the timeline (24h)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  today.setDate(today.getDate() + selectedDate);
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const now = new Date();
  const pixelsPerMinute = 3; // 180px per hour
  const nowOffset = ((now - dayStart) / 60000) * pixelsPerMinute;

  const getProgramStyle = (prog) => {
    const start = new Date(prog.start);
    const end = new Date(prog.end);
    const left = Math.max(0, ((start - dayStart) / 60000) * pixelsPerMinute);
    const width = Math.max(2, ((end - start) / 60000) * pixelsPerMinute);
    return { left: `${left}px`, width: `${width}px` };
  };

  const isCurrentProgram = (p) => {
    const n = new Date();
    return new Date(p.start) <= n && new Date(p.end) > n;
  };

  const dateLabels = [
    { offset: -1, label: 'Yesterday' },
    { offset: 0, label: 'Today' },
    { offset: 1, label: 'Tomorrow' },
  ];

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && selectedDate === 0) {
      const scrollTo = Math.max(0, nowOffset - 300);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [loading, selectedDate]);

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">TV Guide</h1>
      </div>
      <div className="section-body">
        <div className="section-sidebar">
          <div className="sidebar-categories">
            {categories.map(cat => (
              <div key={cat.category_id} className={`sidebar-cat-item ${String(selectedCategory) === String(cat.category_id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}>
                <span>{cat.category_name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="epg-grid-container" ref={scrollRef}>
          {/* Date Navigation */}
          <div className="epg-grid-header">
            <div className="epg-grid-date-nav">
              {dateLabels.map(d => (
                <button key={d.offset} className={`epg-grid-date-btn ${selectedDate === d.offset ? 'active' : ''}`}
                  onClick={() => setSelectedDate(d.offset)}>{d.label}</button>
              ))}
            </div>
          </div>

          {loading && <div className="loading-indicator">Loading TV Guide...</div>}

          {!loading && (
            <>
              {/* Timeline */}
              <div className="epg-timeline-row">
                <div className="epg-timeline-spacer" />
                <div className="epg-timeline-hours">
                  {hours.map(h => (
                    <div key={h} className="epg-timeline-hour">{String(h).padStart(2, '0')}:00</div>
                  ))}
                </div>
              </div>

              {/* Channel Rows */}
              <div className="epg-grid-body" style={{ position: 'relative' }}>
                {/* Now line */}
                {selectedDate === 0 && <div className="epg-now-line" style={{ left: `${200 + nowOffset}px` }} />}

                {channels.map(ch => (
                  <div key={ch.stream_id} className="epg-grid-row">
                    <div className="epg-grid-channel">
                      {ch.stream_icon && <img className="epg-grid-channel-icon" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} />}
                      <span className="epg-grid-channel-name">{ch.name}</span>
                    </div>
                    <div className="epg-grid-programs" style={{ width: `${24 * 180}px`, position: 'relative' }}>
                      {(epgByChannel[ch.stream_id] || []).map(prog => (
                        <div key={prog.id} className={`epg-grid-program ${isCurrentProgram(prog) ? 'current' : ''}`}
                          style={getProgramStyle(prog)} title={prog.title}>
                          <div className="epg-grid-program-title">{prog.title}</div>
                          <div className="epg-grid-program-time">
                            {new Date(prog.start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - {new Date(prog.end).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════ MULTI-SCREEN ══════ */
function MultiScreenScreen({ onBack, api }) {
  const [layout, setLayout] = useState(2); // 2 or 4 screens
  const [screens, setScreens] = useState([null, null, null, null]);
  const [activeCell, setActiveCell] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadChannels = async () => {
    if (!api || channels.length > 0) return;
    setLoading(true);
    const streams = await api.getLiveStreams();
    if (streams && Array.isArray(streams)) setChannels(streams);
    setLoading(false);
  };

  const handlePickChannel = (ch) => {
    const newScreens = [...screens];
    newScreens[activeCell] = ch;
    setScreens(newScreens);
    setShowPicker(false);
  };

  const handleClearCell = (idx) => {
    const newScreens = [...screens];
    newScreens[idx] = null;
    setScreens(newScreens);
  };

  const openPicker = (idx) => {
    setActiveCell(idx);
    setShowPicker(true);
    loadChannels();
  };

  const filteredChannels = channels.filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 50);
  const visibleCells = layout;

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">Multi Screen</h1>
        <div className="section-header-right">
          <button className={`header-filter-btn ${layout === 2 ? 'active' : ''}`} onClick={() => setLayout(2)} title="2 screens">2</button>
          <button className={`header-filter-btn ${layout === 4 ? 'active' : ''}`} onClick={() => setLayout(4)} title="4 screens">4</button>
        </div>
      </div>
      <div style={{flex: 1, position: 'relative', display: 'flex'}}>
        <div className={`multiscreen-container multiscreen-${layout}`} style={{flex: 1}}>
          {Array.from({ length: visibleCells }, (_, idx) => (
            <div key={idx} className={`multiscreen-cell ${activeCell === idx ? 'active' : ''}`} onClick={() => !screens[idx] && openPicker(idx)}>
              {screens[idx] ? (
                <>
                  <div className="multiscreen-cell-label">{screens[idx].name}</div>
                  <button className="multiscreen-cell-close" onClick={(e) => { e.stopPropagation(); handleClearCell(idx); }}>&#10005;</button>
                  {api && <VideoPlayer url={api.getLiveUrl(screens[idx].stream_id, 'ts')} title={screens[idx].name} inline={true} />}
                </>
              ) : (
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', flexDirection: 'column', gap: 8}}
                  onClick={() => openPicker(idx)}>
                  <div style={{fontSize: 36, color: 'var(--text-muted)'}}>+</div>
                  <div style={{fontSize: 12, color: 'var(--text-muted)'}}>Add Channel</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Channel Picker Overlay */}
        {showPicker && (
          <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 10, display: 'flex', flexDirection: 'column', padding: 20, animation: 'fadeIn 0.2s'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
              <button className="back-btn" onClick={() => setShowPicker(false)}>&#10005; Close</button>
              <h2 style={{fontSize: 16, fontWeight: 700, color: 'var(--text)'}}>Select Channel for Screen {activeCell + 1}</h2>
            </div>
            <input className="search-global-input" placeholder="Search channels..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{marginBottom: 16, maxWidth: 400}} />
            {loading && <div className="loading-indicator">Loading channels...</div>}
            <div style={{flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4}}>
              {filteredChannels.map(ch => (
                <div key={ch.stream_id} className="ch-item" onClick={() => handlePickChannel(ch)} style={{cursor: 'pointer'}}>
                  {ch.stream_icon ? <img className="ch-icon-img" src={ch.stream_icon} alt="" onError={e => e.target.style.display='none'} /> : null}
                  <div className="ch-icon" style={ch.stream_icon ? {display:'none'} : {}}>{(ch.name || '?').charAt(0)}</div>
                  <div className="ch-info"><div className="ch-name">{ch.name}</div></div>
                  <span className="ep-play">&#9654;</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Player license helper ── */
function getPlayerLicense() {
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

/* ══════ MAIN APP ══════ */
export default function App() {
  const [credentials, setCredentials] = useState(null);
  const [screen, setScreen] = useState('home');
  const [playerLicense] = useState(() => getPlayerLicense());
  const [api, setApi] = useState(null);
  const [contentStats, setContentStats] = useState({ live: 0, vod: 0, series: 0 });

  useEffect(() => {
    if (credentials && credentials.url && credentials.username && credentials.password) {
      setApi(createXtreamApi(credentials.url, credentials.username, credentials.password));
    }
  }, [credentials]);

  // Fetch content stats for home screen
  useEffect(() => {
    if (!api) return;
    const fetchStats = async () => {
      const [live, vod, series] = await Promise.all([
        api.getLiveStreams(),
        api.getVodStreams(),
        api.getSeries(),
      ]);
      setContentStats({
        live: live && Array.isArray(live) ? live.length : 0,
        vod: vod && Array.isArray(vod) ? vod.length : 0,
        series: series && Array.isArray(series) ? series.length : 0,
      });
    };
    fetchStats();
  }, [api]);

  const isTrialExpired = playerLicense.type === 'trial' && playerLicense.trialDaysLeft <= 0;

  const handleActivated = (creds) => {
    // Save as first playlist if none exist
    const existing = getPlaylists();
    if (existing.length === 0 && creds.url && creds.url !== 'http://demo') {
      savePlaylists([{ id: Date.now(), name: 'My Playlist', server_url: creds.url, username: creds.username, password: creds.password, is_default: true }]);
    }
    setCredentials(creds);
    setScreen('home');
  };

  const handleSwitchPlaylist = (creds) => {
    setCredentials(creds);
    setScreen('home');
  };

  if (!credentials) {
    return <ActivationScreen onActivated={handleActivated} />;
  }

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
    case 'epg':
      return <EPGGridScreen onBack={() => setScreen('home')} api={api} />;
    case 'multiscreen':
      return <MultiScreenScreen onBack={() => setScreen('home')} api={api} />;
    case 'speedtest':
      return <SpeedTestScreen onBack={() => setScreen('home')} />;
    case 'playlists':
      return <PlaylistsScreen onBack={() => setScreen('home')} onSwitch={handleSwitchPlaylist} activePlaylist={credentials} />;
    default:
      return <HomeScreen onNavigate={handleNavigate} credentials={credentials} playerLicense={playerLicense} contentStats={contentStats} />;
  }
}
