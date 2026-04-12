const express = require('express');
const router = express.Router();
const db = require('../db');

// Lookup device by MAC address (public)
router.post('/device/lookup', (req, res) => {
  const { mac_address } = req.body;
  if (!mac_address) return res.status(400).json({ error: 'mac_address required' });

  const device = db.prepare('SELECT id, mac_address, device_key, name, status, license_type, license_expires_at, created_at FROM devices WHERE mac_address = ?').get(mac_address);
  if (!device) return res.status(404).json({ error: 'Device not found. Please activate your device in the player first.' });

  // Check license validity
  let licenseValid = true;
  if (device.license_type === 'trial') {
    const trialDays = db.prepare("SELECT value FROM settings WHERE key = 'trial_days'").get();
    const days = trialDays ? parseInt(trialDays.value) : 7;
    const created = new Date(device.created_at);
    const diffDays = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
    if (diffDays > days) licenseValid = false;
  } else if (device.license_type === 'yearly' && device.license_expires_at) {
    if (new Date(device.license_expires_at) < new Date()) licenseValid = false;
  }

  const playlists = db.prepare('SELECT * FROM playlists WHERE device_id = ? ORDER BY is_default DESC, id ASC').all(device.id);

  res.json({
    device: {
      id: device.id,
      mac_address: device.mac_address,
      name: device.name,
      status: device.status,
      license_type: device.license_type,
      license_valid: licenseValid,
      license_expires_at: device.license_expires_at,
      created_at: device.created_at,
    },
    playlists,
  });
});

// Add playlist to device (public, requires MAC)
router.post('/device/playlists', (req, res) => {
  const { mac_address, name, server_url, username, password } = req.body;
  if (!mac_address || !server_url || !username || !password) {
    return res.status(400).json({ error: 'mac_address, server_url, username, and password are required' });
  }

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ?').get(mac_address);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE device_id = ?').get(device.id).count;
  const isDefault = existingCount === 0 ? 1 : 0;

  const result = db.prepare('INSERT INTO playlists (device_id, name, server_url, username, password, is_default) VALUES (?, ?, ?, ?, ?, ?)').run(
    device.id, name || 'My Playlist', server_url, username, password, isDefault
  );

  // Also update device's primary playlist fields if this is the first/default
  if (isDefault) {
    db.prepare('UPDATE devices SET playlist_url = ?, playlist_username = ?, playlist_password = ? WHERE id = ?').run(server_url, username, password, device.id);
  }

  res.json({ id: result.lastInsertRowid, message: 'Playlist added' });
});

// Update playlist
router.put('/device/playlists/:id', (req, res) => {
  const { mac_address, name, server_url, username, password } = req.body;
  if (!mac_address) return res.status(400).json({ error: 'mac_address required' });

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ?').get(mac_address);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?').get(req.params.id, device.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  db.prepare('UPDATE playlists SET name = ?, server_url = ?, username = ?, password = ? WHERE id = ?').run(
    name || playlist.name, server_url || playlist.server_url, username || playlist.username, password || playlist.password, req.params.id
  );

  // If this is default, update device fields too
  if (playlist.is_default) {
    db.prepare('UPDATE devices SET playlist_url = ?, playlist_username = ?, playlist_password = ? WHERE id = ?').run(
      server_url || playlist.server_url, username || playlist.username, password || playlist.password, device.id
    );
  }

  res.json({ message: 'Playlist updated' });
});

// Delete playlist
router.delete('/device/playlists/:id', (req, res) => {
  const { mac_address } = req.body;
  if (!mac_address) return res.status(400).json({ error: 'mac_address required' });

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ?').get(mac_address);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?').get(req.params.id, device.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);

  // If deleted was default, make next one default
  if (playlist.is_default) {
    const next = db.prepare('SELECT id FROM playlists WHERE device_id = ? ORDER BY id ASC LIMIT 1').get(device.id);
    if (next) {
      db.prepare('UPDATE playlists SET is_default = 1 WHERE id = ?').run(next.id);
      const nextPl = db.prepare('SELECT * FROM playlists WHERE id = ?').get(next.id);
      db.prepare('UPDATE devices SET playlist_url = ?, playlist_username = ?, playlist_password = ? WHERE id = ?').run(
        nextPl.server_url, nextPl.username, nextPl.password, device.id
      );
    } else {
      db.prepare("UPDATE devices SET playlist_url = '', playlist_username = '', playlist_password = '' WHERE id = ?").run(device.id);
    }
  }

  res.json({ message: 'Playlist deleted' });
});

// Set playlist as default
router.post('/device/playlists/:id/default', (req, res) => {
  const { mac_address } = req.body;
  if (!mac_address) return res.status(400).json({ error: 'mac_address required' });

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ?').get(mac_address);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND device_id = ?').get(req.params.id, device.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  db.prepare('UPDATE playlists SET is_default = 0 WHERE device_id = ?').run(device.id);
  db.prepare('UPDATE playlists SET is_default = 1 WHERE id = ?').run(req.params.id);

  // Update device primary playlist
  db.prepare('UPDATE devices SET playlist_url = ?, playlist_username = ?, playlist_password = ? WHERE id = ?').run(
    playlist.server_url, playlist.username, playlist.password, device.id
  );

  res.json({ message: 'Default playlist updated' });
});

// Get packages (public)
router.get('/packages', (req, res) => {
  const packages = db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC').all();
  res.json(packages);
});

module.exports = router;
