const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const XtreamService = require('../services/xtreamService');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [playlists] = await pool.query(
      `SELECT p.*, COUNT(dp.device_id) as device_count
       FROM playlists p LEFT JOIN device_playlists dp ON p.id = dp.playlist_id
       GROUP BY p.id ORDER BY p.name`
    );
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, xtream_url, xtream_username, xtream_password } = req.body;
    if (!name || !xtream_url || !xtream_username || !xtream_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Test connection
    try {
      const xtream = new XtreamService(xtream_url, xtream_username, xtream_password);
      await xtream.authenticate();
    } catch (e) {
      return res.status(400).json({ error: 'Failed to connect to Xtream server. Check credentials.' });
    }

    const [result] = await pool.query(
      'INSERT INTO playlists (name, xtream_url, xtream_username, xtream_password) VALUES (?, ?, ?, ?)',
      [name, xtream_url, xtream_username, xtream_password]
    );

    res.status(201).json({ id: result.insertId, message: 'Playlist created' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, xtream_url, xtream_username, xtream_password, is_active } = req.body;
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (xtream_url) { updates.push('xtream_url = ?'); params.push(xtream_url); }
    if (xtream_username) { updates.push('xtream_username = ?'); params.push(xtream_username); }
    if (xtream_password) { updates.push('xtream_password = ?'); params.push(xtream_password); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length) {
      params.push(req.params.id);
      await pool.query(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ message: 'Playlist updated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM playlists WHERE id = ?', [req.params.id]);
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test playlist connection
router.post('/:id/test', async (req, res) => {
  try {
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    if (!playlists.length) return res.status(404).json({ error: 'Playlist not found' });

    const xtream = XtreamService.fromPlaylist(playlists[0]);
    const info = await xtream.authenticate();
    res.json({ status: 'connected', server_info: info });
  } catch (err) {
    res.status(400).json({ status: 'failed', error: err.message });
  }
});

module.exports = router;
