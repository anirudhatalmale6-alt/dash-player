import { useState, useEffect, useRef, useCallback } from 'react';
import { mockData } from './services/xtreamApi';
import './styles.css';

function LoginScreen({ onLogin }) {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // For now use mock data, in production connects to real server
    setTimeout(() => {
      onLogin({ url: url || 'http://demo.server', username: username || 'demo', password: password || 'demo' });
      setLoading(false);
    }, 500);
  };

  const handleDemo = () => {
    onLogin({ url: 'http://demo.server', username: 'demo', password: 'demo' });
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
          <button onClick={handleDemo} style={{ background: 'none', border: 'none', color: 'var(--purple-light)', cursor: 'pointer', fontSize: 13 }}>
            Launch Demo Mode
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerApp({ credentials }) {
  const [activeTab, setActiveTab] = useState('live'); // live, vod, series
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [channels, setChannels] = useState([]);
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'live') {
      setCategories([{ category_id: 'all', category_name: 'All Channels' }, ...mockData.categories]);
      setChannels(mockData.channels);
      setSelectedCategory('all');
    } else if (activeTab === 'vod') {
      setCategories([{ category_id: 'all', category_name: 'All Movies' }, ...mockData.vodCategories]);
      setChannels(mockData.vodStreams);
      setSelectedCategory('all');
    } else if (activeTab === 'series') {
      setCategories([{ category_id: 'all', category_name: 'All Series' }, ...mockData.seriesCategories]);
      setChannels(mockData.series);
      setSelectedCategory('all');
    }
    setSearchQuery('');
  }, [activeTab]);

  // Filter channels by category and search
  useEffect(() => {
    let filtered = channels;
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(ch => ch.category_id === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ch => ch.name.toLowerCase().includes(q));
    }
    setFilteredChannels(filtered);
  }, [channels, selectedCategory, searchQuery]);

  // Load EPG for selected channel
  useEffect(() => {
    if (selectedChannel && activeTab === 'live') {
      const epg = mockData.generateEPG(selectedChannel.num);
      setEpgData(epg);
    }
  }, [selectedChannel, activeTab]);

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setShowOverlay(!showOverlay);
      if (e.key === 'Backspace') setShowOverlay(true);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showOverlay]);

  const handleChannelSelect = (channel) => {
    setSelectedChannel(channel);
    if (activeTab === 'live') {
      // In real app, start playing stream
    }
  };

  const getCategoryCount = (catId) => {
    if (catId === 'all') return channels.length;
    return channels.filter(ch => ch.category_id === catId).length;
  };

  const getCurrentProgram = (channelNum) => {
    const epg = mockData.generateEPG(channelNum);
    const now = new Date();
    return epg.find(p => new Date(p.start) <= now && new Date(p.end) > now);
  };

  const getEPGProgress = (program) => {
    const now = new Date();
    const start = new Date(program.start);
    const end = new Date(program.end);
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentProgram = (program) => {
    const now = new Date();
    return new Date(program.start) <= now && new Date(program.end) > now;
  };

  const isPastProgram = (program) => {
    return new Date(program.end) < new Date();
  };

  return (
    <div className="player-container" onClick={() => activeTab === 'live' && selectedChannel && setShowOverlay(!showOverlay)}>
      {/* Video Area */}
      {selectedChannel && activeTab === 'live' ? (
        <div className="video-placeholder">
          <div className="video-placeholder-content">
            <div className="video-placeholder-logo">D</div>
            <h2>{selectedChannel.name}</h2>
            <p>{getCurrentProgram(selectedChannel.num)?.title || 'Live'}</p>
          </div>
        </div>
      ) : !showOverlay ? (
        <div className="video-placeholder">
          <div className="video-placeholder-content">
            <div className="video-placeholder-logo">D</div>
            <h2>Dash Player</h2>
            <p>Select a channel to start watching</p>
          </div>
        </div>
      ) : null}

      {/* Main Overlay */}
      <div className={`overlay ${!showOverlay ? 'hidden' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Sidebar - Categories */}
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">D</div>
            <div className="sidebar-title">Dash Player</div>
          </div>

          {/* Navigation Tabs */}
          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
              Live TV
            </button>
            <button className={`nav-tab ${activeTab === 'vod' ? 'active' : ''}`} onClick={() => setActiveTab('vod')}>
              Movies
            </button>
            <button className={`nav-tab ${activeTab === 'series' ? 'active' : ''}`} onClick={() => setActiveTab('series')}>
              Series
            </button>
          </div>

          {/* Category List */}
          <div className="category-list">
            {categories.map(cat => (
              <div
                key={cat.category_id}
                className={`category-item ${selectedCategory === cat.category_id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category_id)}
              >
                <span>{cat.category_name}</span>
                <span className="category-count">{getCategoryCount(cat.category_id)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content area - changes based on tab */}
        {activeTab === 'live' ? (
          <>
            {/* Channel List */}
            <div className="channel-panel">
              <div className="channel-header">Channels ({filteredChannels.length})</div>
              <div className="channel-search">
                <input
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="channel-list">
                {filteredChannels.map(ch => {
                  const prog = getCurrentProgram(ch.num);
                  return (
                    <div
                      key={ch.stream_id}
                      className={`channel-item ${selectedChannel?.stream_id === ch.stream_id ? 'active' : ''}`}
                      onClick={() => handleChannelSelect(ch)}
                    >
                      <span className="channel-num">{ch.num}</span>
                      <div className="channel-icon">{ch.name.charAt(0)}</div>
                      <div className="channel-info">
                        <div className="channel-name">{ch.name}</div>
                        <div className="channel-program">{prog?.title || 'No information'}</div>
                      </div>
                      {selectedChannel?.stream_id === ch.stream_id && <div className="channel-live-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EPG Panel */}
            {selectedChannel ? (
              <div className="epg-panel">
                <div className="epg-header">
                  <div className="epg-channel-info">
                    <div>
                      <div className="epg-channel-name">{selectedChannel.name}</div>
                      <div className="epg-channel-cat">{selectedChannel.category_name}</div>
                    </div>
                  </div>
                  <div className="epg-now-badge">LIVE</div>
                </div>
                <div className="epg-list">
                  {epgData.map(prog => {
                    const current = isCurrentProgram(prog);
                    const past = isPastProgram(prog);
                    return (
                      <div key={prog.id} className={`epg-item ${current ? 'current' : ''} ${past ? 'past' : ''}`}>
                        <div className="epg-time">{formatTime(prog.start)}</div>
                        <div className="epg-program-info">
                          <div className="epg-program-title">{prog.title}</div>
                          <div className="epg-program-desc">{prog.description}</div>
                          {current && (
                            <div className="epg-progress">
                              <div className="epg-progress-bar" style={{ width: `${getEPGProgress(prog)}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="epg-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>&#128250;</div>
                  <div style={{ fontSize: 16 }}>Select a channel to view EPG</div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* VOD / Series Content */
          <div className="content-panel">
            <div className="content-header">
              <div className="channel-header">
                {activeTab === 'vod' ? 'Movies' : 'Series'} ({filteredChannels.length})
              </div>
              <div className="channel-search">
                <input
                  placeholder={`Search ${activeTab === 'vod' ? 'movies' : 'series'}...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="vod-grid">
              {filteredChannels.map(item => (
                <div key={item.stream_id || item.series_id} className="vod-card" onClick={() => handleChannelSelect(item)}>
                  <div className="vod-poster">{item.name.charAt(0)}</div>
                  <div className="vod-info">
                    <div className="vod-title">{item.name}</div>
                    {item.rating && (
                      <div className="vod-rating">
                        <span className="vod-star">&#9733;</span> {item.rating}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Now Playing Bar (when overlay hidden) */}
      {!showOverlay && selectedChannel && activeTab === 'live' && (
        <div className="now-playing">
          <div className="now-info">
            <div className="now-channel-icon">{selectedChannel.name.charAt(0)}</div>
            <div>
              <div className="now-channel-name">{selectedChannel.name}</div>
              <div className="now-program">{getCurrentProgram(selectedChannel.num)?.title}</div>
              <div className="now-time">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <div className="now-controls">
            <button className="now-btn" onClick={e => { e.stopPropagation(); setShowOverlay(true); }}>&#9776;</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [credentials, setCredentials] = useState(null);

  if (!credentials) {
    return <LoginScreen onLogin={setCredentials} />;
  }

  return <PlayerApp credentials={credentials} />;
}
