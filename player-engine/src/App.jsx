import { useState, useEffect } from 'react';
import { mockData } from './services/xtreamApi';
import './styles.css';

/* ── LOGIN SCREEN ── */
function LoginScreen({ onLogin }) {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onLogin({ url: url || 'http://demo.server', username: username || 'demo', password: password || 'demo' });
      setLoading(false);
    }, 500);
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">D</div>
        <div className="login-title">Dash Player</div>
        <div className="login-subtitle">Enter your playlist credentials</div>
        <form onSubmit={handleSubmit}>
          <input className="login-input" placeholder="Server URL" value={url} onChange={e => setUrl(e.target.value)} />
          <input className="login-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input className="login-input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => onLogin({ url: 'http://demo', username: 'demo', password: 'demo' })} className="demo-btn">
            Launch Demo Mode
          </button>
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
                {epgData.map(prog => (
                  <div key={prog.id} className={`epg-prog ${isCurrentProgram(prog) ? 'current' : ''} ${isPastProgram(prog) ? 'past' : ''}`}>
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

/* ── MAIN APP ── */
export default function App() {
  const [credentials, setCredentials] = useState(null);
  const [screen, setScreen] = useState('home'); // home, live, vod, series

  if (!credentials) {
    return <LoginScreen onLogin={(creds) => { setCredentials(creds); setScreen('home'); }} />;
  }

  const handleNavigate = (section) => {
    if (['live', 'vod', 'series'].includes(section)) {
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
    default:
      return <HomeScreen onNavigate={handleNavigate} credentials={credentials} />;
  }
}
