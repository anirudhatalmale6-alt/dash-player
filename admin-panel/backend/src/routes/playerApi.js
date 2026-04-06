const express = require('express');
const pool = require('../config/database');
const XtreamService = require('../services/xtreamService');

const router = express.Router();

// Device authentication - used by player apps (no admin auth needed)
router.post('/device/auth', async (req, res) => {
  try {
    const { mac_address, device_key } = req.body;
    if (!mac_address || !device_key) {
      return res.status(400).json({ error: 'MAC address and device key required' });
    }

    const [devices] = await pool.query(
      `SELECT d.*, p.name as package_name, p.max_connections
       FROM devices d LEFT JOIN packages p ON d.package_id = p.id
       WHERE d.mac_address = ? AND d.device_key = ?`,
      [mac_address, device_key]
    );

    if (!devices.length) {
      return res.status(401).json({ error: 'Device not registered' });
    }

    const device = devices[0];

    if (!device.is_active) {
      return res.status(403).json({ error: 'Device is disabled' });
    }

    if (!device.is_unlimited && device.expiry_date && new Date(device.expiry_date) < new Date()) {
      return res.status(403).json({ error: 'Subscription expired', expiry_date: device.expiry_date });
    }

    // Update last activity
    await pool.query(
      'UPDATE devices SET last_activity = NOW(), last_ip = ? WHERE id = ?',
      [req.ip, device.id]
    );

    // Get assigned playlists
    const [playlists] = await pool.query(
      `SELECT pl.id, pl.name, pl.xtream_url, pl.xtream_username, pl.xtream_password
       FROM playlists pl
       JOIN device_playlists dp ON pl.id = dp.playlist_id
       WHERE dp.device_id = ? AND pl.is_active = 1
       ORDER BY dp.sort_order`,
      [device.id]
    );

    res.json({
      status: 'authorized',
      device: {
        id: device.id,
        name: device.device_name,
        type: device.device_type,
        package: device.package_name,
        expiry: device.is_unlimited ? 'unlimited' : device.expiry_date
      },
      playlists: playlists.map(p => ({
        id: p.id,
        name: p.name,
        url: p.xtream_url,
        username: p.xtream_username,
        password: p.xtream_password
      }))
    });
  } catch (err) {
    console.error('Device auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat - keep device online status updated
router.post('/device/heartbeat', async (req, res) => {
  try {
    const { mac_address, device_key } = req.body;
    await pool.query(
      'UPDATE devices SET last_activity = NOW(), last_ip = ? WHERE mac_address = ? AND device_key = ?',
      [req.ip, mac_address, device_key]
    );
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy Xtream API calls through the admin server (hides credentials from device)
router.get('/xtream/:playlistId/:action', async (req, res) => {
  try {
    const { mac_address, device_key } = req.query;
    // Verify device
    const [devices] = await pool.query(
      'SELECT id FROM devices WHERE mac_address = ? AND device_key = ? AND is_active = 1',
      [mac_address, device_key]
    );
    if (!devices.length) return res.status(401).json({ error: 'Unauthorized' });

    // Verify playlist assigned to device
    const [playlists] = await pool.query(
      `SELECT pl.* FROM playlists pl
       JOIN device_playlists dp ON pl.id = dp.playlist_id
       WHERE dp.device_id = ? AND pl.id = ? AND pl.is_active = 1`,
      [devices[0].id, req.params.playlistId]
    );
    if (!playlists.length) return res.status(403).json({ error: 'Playlist not assigned' });

    const xtream = XtreamService.fromPlaylist(playlists[0]);
    let data;

    switch (req.params.action) {
      case 'live_categories': data = await xtream.getLiveCategories(); break;
      case 'live_streams': data = await xtream.getLiveStreams(req.query.category_id); break;
      case 'vod_categories': data = await xtream.getVodCategories(); break;
      case 'vod_streams': data = await xtream.getVodStreams(req.query.category_id); break;
      case 'series_categories': data = await xtream.getSeriesCategories(); break;
      case 'series': data = await xtream.getSeries(req.query.category_id); break;
      case 'series_info': data = await xtream.getSeriesInfo(req.query.series_id); break;
      case 'epg': data = await xtream.getEPG(req.query.stream_id); break;
      case 'server_info': data = await xtream.authenticate(); break;
      default: return res.status(400).json({ error: 'Invalid action' });
    }

    res.json(data);
  } catch (err) {
    console.error('Xtream proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Get stream URL (returns the URL for the player to connect)
router.get('/stream-url', async (req, res) => {
  try {
    const { mac_address, device_key, playlist_id, stream_id, type, extension } = req.query;

    const [devices] = await pool.query(
      'SELECT id FROM devices WHERE mac_address = ? AND device_key = ? AND is_active = 1',
      [mac_address, device_key]
    );
    if (!devices.length) return res.status(401).json({ error: 'Unauthorized' });

    const [playlists] = await pool.query(
      `SELECT pl.* FROM playlists pl
       JOIN device_playlists dp ON pl.id = dp.playlist_id
       WHERE dp.device_id = ? AND pl.id = ? AND pl.is_active = 1`,
      [devices[0].id, playlist_id]
    );
    if (!playlists.length) return res.status(403).json({ error: 'Playlist not assigned' });

    const xtream = XtreamService.fromPlaylist(playlists[0]);
    let url;

    switch (type) {
      case 'live': url = xtream.getLiveStreamUrl(stream_id, extension || 'ts'); break;
      case 'vod': url = xtream.getVodStreamUrl(stream_id, extension || 'mp4'); break;
      case 'series': url = xtream.getSeriesStreamUrl(stream_id, extension || 'mp4'); break;
      default: return res.status(400).json({ error: 'Invalid stream type' });
    }

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
