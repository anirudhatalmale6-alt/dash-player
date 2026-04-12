const express = require('express');
const router = express.Router();
const db = require('../db');

// Lookup device by MAC address + device key (public)
router.post('/device/lookup', (req, res) => {
  const { mac_address, device_key } = req.body;
  if (!mac_address || !device_key) return res.status(400).json({ error: 'MAC address and Device Key are required' });

  let device = db.prepare('SELECT id, mac_address, device_key, name, status, license_type, license_expires_at, created_at FROM devices WHERE mac_address = ? AND device_key = ?').get(mac_address, device_key);

  // Auto-register as trial device if not found
  if (!device) {
    // Check if MAC exists with different key
    const existingMac = db.prepare('SELECT id FROM devices WHERE mac_address = ?').get(mac_address);
    if (existingMac) return res.status(403).json({ error: 'Invalid Device Key for this MAC address.' });

    // Check if key exists with different MAC
    const existingKey = db.prepare('SELECT id FROM devices WHERE device_key = ?').get(device_key);
    if (existingKey) return res.status(403).json({ error: 'This Device Key is already registered to another MAC address.' });

    // Create new trial device
    const result = db.prepare(
      'INSERT INTO devices (mac_address, device_key, name, status, license_type) VALUES (?, ?, ?, ?, ?)'
    ).run(mac_address, device_key, '', 'active', 'trial');

    device = db.prepare('SELECT id, mac_address, device_key, name, status, license_type, license_expires_at, created_at FROM devices WHERE id = ?').get(result.lastInsertRowid);
  }

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

// Add playlist to device (public, requires MAC + device_key)
router.post('/device/playlists', (req, res) => {
  const { mac_address, device_key, name, server_url, username, password } = req.body;
  if (!mac_address || !device_key || !server_url || !username || !password) {
    return res.status(400).json({ error: 'mac_address, device_key, server_url, username, and password are required' });
  }

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ? AND device_key = ?').get(mac_address, device_key);
  if (!device) return res.status(404).json({ error: 'Device not found or invalid key' });

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
  const { mac_address, device_key, name, server_url, username, password } = req.body;
  if (!mac_address || !device_key) return res.status(400).json({ error: 'mac_address and device_key required' });

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ? AND device_key = ?').get(mac_address, device_key);
  if (!device) return res.status(404).json({ error: 'Device not found or invalid key' });

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
  const { mac_address, device_key } = req.body;
  if (!mac_address || !device_key) return res.status(400).json({ error: 'mac_address and device_key required' });

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ? AND device_key = ?').get(mac_address, device_key);
  if (!device) return res.status(404).json({ error: 'Device not found or invalid key' });

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
  const { mac_address, device_key } = req.body;
  if (!mac_address || !device_key) return res.status(400).json({ error: 'mac_address and device_key required' });

  const device = db.prepare('SELECT id FROM devices WHERE mac_address = ? AND device_key = ?').get(mac_address, device_key);
  if (!device) return res.status(404).json({ error: 'Device not found or invalid key' });

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

// Submit MAC change request from player/website (public)
router.post('/device/mac-change', (req, res) => {
  const { old_mac, device_key, new_mac } = req.body;
  if (!old_mac || !device_key || !new_mac) {
    return res.status(400).json({ error: 'old_mac, device_key, and new_mac are required' });
  }

  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?').get(old_mac, device_key);
  if (!device) return res.status(404).json({ error: 'Device not found or invalid key' });

  if (device.is_banned) {
    return res.status(403).json({ error: 'Device is banned. Contact support.' });
  }

  if (device.mac_changes_used >= device.mac_change_limit) {
    return res.status(403).json({ error: 'MAC change limit reached. Contact support.' });
  }

  // Check for existing pending request
  const existing = db.prepare("SELECT id FROM mac_change_requests WHERE device_id = ? AND status = 'pending'").get(device.id);
  if (existing) {
    return res.status(409).json({ error: 'A pending MAC change request already exists for this device' });
  }

  const result = db.prepare(
    'INSERT INTO mac_change_requests (device_id, old_mac, new_mac, device_key) VALUES (?, ?, ?, ?)'
  ).run(device.id, old_mac, new_mac, device_key);

  res.json({ success: true, request_id: result.lastInsertRowid, message: 'MAC change request submitted. Awaiting admin approval.' });
});

// Get packages (public)
router.get('/packages', (req, res) => {
  const packages = db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC').all();
  res.json(packages);
});

module.exports = router;
