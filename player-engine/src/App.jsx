import { useState, useEffect, useCallback, useRef } from 'react';
import { mockData } from './services/xtreamApi';
import axios from 'axios';
import Hls from 'hls.js';
import './styles.css';

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
function VideoPlayer({ url, onClose, title }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url || !videoRef.current) return;
    setError(null);
    setLoading(true);
    const video = videoRef.current;

    // Try HLS first (.m3u8)
    if (url.includes('.m3u8') || url.includes('/live/')) {
      const hlsUrl = url.replace(/\.\w+$/, '.m3u8');
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            // Try direct URL as fallback
            hls.destroy();
            video.src = url;
            video.play().catch(() => setError('Stream unavailable'));
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', () => { setLoading(false); video.play(); });
      }
    } else {
      // Direct URL (mp4, mkv, etc.)
      video.src = url;
      video.addEventListener('loadedmetadata', () => { setLoading(false); });
      video.addEventListener('error', () => setError('Stream unavailable'));
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      video.src = '';
    };
  }, [url]);

  return (
    <div className="video-player-overlay">
      <div className="video-player-header">
        <button className="video-close-btn" onClick={onClose}>&#10005;</button>
        <span className="video-title">{title || 'Playing'}</span>
      </div>
      {loading && !error && <div className="video-loading">Connecting to stream...</div>}
      {error && <div className="video-error">{error}</div>}
      <video ref={videoRef} className="video-element" controls autoPlay />
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

  const filtered = channels.filter(ch => {
    const matchSearch = !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

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
                onClick={() => setSelectedChannel(ch)}
                onDoubleClick={() => { setSelectedChannel(ch); setPlayingChannel(ch); }}
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
                <button className="ch-play-btn" onClick={(e) => { e.stopPropagation(); setSelectedChannel(ch); setPlayingChannel(ch); }} title="Play">&#9654;</button>
                {selectedChannel?.stream_id === ch.stream_id && <div className="ch-live-dot" />}
              </div>
          ))}
        </div>

        {/* EPG */}
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

      {/* Video Player Overlay */}
      {playingChannel && api && (
        <VideoPlayer
          url={api.getLiveUrl(playingChannel.stream_id, 'm3u8')}
          title={playingChannel.name}
          onClose={() => setPlayingChannel(null)}
        />
      )}
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

  const filtered = allItems.filter(item => {
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

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
    return (
      <div className="section-screen">
        <div className="section-header">
          <button className="back-btn" onClick={() => { setSelectedSeries(null); setSeriesInfo(null); }}>&#8592; Back</button>
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
                {selectedSeries.rating && <p className="series-meta">Rating: {selectedSeries.rating}</p>}
              </div>
            </div>
            {seriesLoading && <div className="loading-indicator">Loading episodes...</div>}
            {!seriesLoading && seasons.length > 0 && seasons.map(season => (
              <div key={season} className="series-season">
                <h3 className="series-season-title">Season {season}</h3>
                <div className="series-episodes">
                  {seriesInfo.episodes[season].map(ep => (
                    <div key={ep.id} className="series-episode">
                      <span className="ep-num">E{ep.episode_num}</span>
                      <div className="ep-info">
                        <div className="ep-title">{ep.title || `Episode ${ep.episode_num}`}</div>
                        {ep.info?.duration && <span className="ep-duration">{ep.info.duration}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!seriesLoading && seasons.length === 0 && <div className="loading-indicator">No episode data available</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-screen">
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>&#8592; Home</button>
        <h1 className="section-title">{title}</h1>
        <div className="section-header-right">
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

        <div className="section-media-grid">
          {(loading || itemsLoading) && <div className="loading-indicator">Loading {title.toLowerCase()}...</div>}
          {!loading && !itemsLoading && filtered.map(item => (
            <div key={item.stream_id || item.series_id} className="media-card" onClick={() => !isVod && handleSeriesClick(item)}>
              {(item.stream_icon || item.cover) ? (
                <img className="media-poster-img" src={item.stream_icon || item.cover} alt=""
                  onError={e => { e.target.style.display = 'none'; if(e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'; }} />
              ) : null}
              <div className="media-poster" style={(item.stream_icon || item.cover) ? { display: 'none' } : {}}>{(item.name || '?').charAt(0)}</div>
              <div className="media-info">
                <div className="media-title">{item.name}</div>
                {item.rating && item.rating !== '0' && (
                  <div className="media-rating">
                    <span className="media-star">&#9733;</span> {item.rating}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
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

  const handleNavigate = (section) => {
    if (['live', 'vod', 'series', 'radio', 'settings'].includes(section)) {
      setScreen(section);
    }
  };

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
    default:
      return <HomeScreen onNavigate={handleNavigate} credentials={credentials} playerLicense={playerLicense} />;
  }
}
