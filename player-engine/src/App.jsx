import { useState, useEffect, useCallback } from 'react';
import { mockData } from './services/xtreamApi';
import './styles.css';

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
  const panelUrl = 'https://panel.dashplayer.tv';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
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
              <button className="activation-btn activation-btn-exit">
                EXIT
              </button>
            </div>
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
function HomeScreen({ onNavigate, credentials }) {
  const [time, setTime] = useState(new Date());

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
          <button className="home-icon-btn" title="Search">&#128269;</button>
          <button className="home-icon-btn" title="Settings">&#9881;</button>
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
          Current Playlist: <strong>{credentials.username}</strong> &nbsp;|&nbsp; Server: <strong>{credentials.url}</strong>
        </div>
        <div className="home-version">V: 1.0.0</div>
      </div>
    </div>
  );
}

/* ── LIVE TV SCREEN ── */
function LiveTVScreen({ onBack }) {
  const [categories] = useState([{ category_id: 'all', category_name: 'All Channels' }, ...mockData.categories]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [epgData, setEpgData] = useState([]);

  const channels = mockData.channels;
  const filtered = channels.filter(ch => {
    const matchCat = selectedCategory === 'all' || ch.category_id === selectedCategory;
    const matchSearch = !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  useEffect(() => {
    if (selectedChannel) {
      setEpgData(mockData.generateEPG(selectedChannel.num));
    }
  }, [selectedChannel]);

  const getCurrentProgram = (num) => {
    const epg = mockData.generateEPG(num);
    const now = new Date();
    return epg.find(p => new Date(p.start) <= now && new Date(p.end) > now);
  };

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
                className={`sidebar-cat-item ${selectedCategory === cat.category_id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}
              >
                <span>{cat.category_name}</span>
                <span className="sidebar-cat-count">
                  {cat.category_id === 'all' ? channels.length : channels.filter(c => c.category_id === cat.category_id).length}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Channel List */}
        <div className="section-channel-list">
          {filtered.map(ch => {
            const prog = getCurrentProgram(ch.num);
            return (
              <div
                key={ch.stream_id}
                className={`ch-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                onClick={() => setSelectedChannel(ch)}
              >
                <span className="ch-num">{ch.num}</span>
                <div className="ch-icon">{ch.name.charAt(0)}</div>
                <div className="ch-info">
                  <div className="ch-name">{ch.name}</div>
                  <div className="ch-prog">{prog?.title || 'No info'}</div>
                </div>
                {selectedChannel?.stream_id === ch.stream_id && <div className="ch-live-dot" />}
              </div>
            );
          })}
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
    </div>
  );
}

/* ── VOD / SERIES SCREEN ── */
function MediaScreen({ type, onBack }) {
  const isVod = type === 'vod';
  const title = isVod ? 'Movies' : 'Series';
  const allCategories = isVod ? mockData.vodCategories : mockData.seriesCategories;
  const allItems = isVod ? mockData.vodStreams : mockData.series;
  const categories = [{ category_id: 'all', category_name: `All ${title}` }, ...allCategories];

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = allItems.filter(item => {
    const matchCat = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

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
                className={`sidebar-cat-item ${selectedCategory === cat.category_id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}
              >
                <span>{cat.category_name}</span>
                <span className="sidebar-cat-count">
                  {cat.category_id === 'all' ? allItems.length : allItems.filter(i => i.category_id === cat.category_id).length}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-media-grid">
          {filtered.map(item => (
            <div key={item.stream_id || item.series_id} className="media-card">
              <div className="media-poster">{item.name.charAt(0)}</div>
              <div className="media-info">
                <div className="media-title">{item.name}</div>
                {item.rating && (
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

/* ── MAIN APP ── */
export default function App() {
  const [credentials, setCredentials] = useState(null);
  const [screen, setScreen] = useState('home'); // home, live, vod, series

  if (!credentials) {
    return <ActivationScreen onActivated={(creds) => { setCredentials(creds); setScreen('home'); }} />;
  }

  const handleNavigate = (section) => {
    if (['live', 'vod', 'series', 'radio'].includes(section)) {
      setScreen(section);
    }
  };

  switch (screen) {
    case 'live':
      return <LiveTVScreen onBack={() => setScreen('home')} />;
    case 'vod':
      return <MediaScreen type="vod" onBack={() => setScreen('home')} />;
    case 'series':
      return <MediaScreen type="series" onBack={() => setScreen('home')} />;
    case 'radio':
      return <RadioScreen onBack={() => setScreen('home')} />;
    default:
      return <HomeScreen onNavigate={handleNavigate} credentials={credentials} />;
  }
}
