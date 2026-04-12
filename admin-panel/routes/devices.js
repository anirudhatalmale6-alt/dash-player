const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// List devices with pagination and search
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (mac_address LIKE ? OR device_key LIKE ? OR name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM devices WHERE ${where}`).get(...params).count;
  const devices = db.prepare(`SELECT * FROM devices WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  res.json({ devices, total, page, totalPages: Math.ceil(total / limit) });
});

// Get single device
router.get('/:id', (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

// Create device
router.post('/', (req, res) => {
  const { mac_address, device_key, name, status, license_type, license_expires_at, playlist_url, playlist_username, playlist_password } = req.body;
  const mac = mac_address || '';
  const key = device_key || uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();

  try {
    const result = db.prepare(
      'INSERT INTO devices (mac_address, device_key, name, status, license_type, license_expires_at, playlist_url, playlist_username, playlist_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(mac, key, name || '', status || 'active', license_type || 'trial', license_expires_at || null, playlist_url || '', playlist_username || '', playlist_password || '');
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(device);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update device
router.put('/:id', (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { name, status, license_type, license_expires_at, playlist_url, playlist_username, playlist_password } = req.body;
  db.prepare(
    'UPDATE devices SET name = ?, status = ?, license_type = ?, license_expires_at = ?, playlist_url = ?, playlist_username = ?, playlist_password = ?, updated_at = datetime("now") WHERE id = ?'
  ).run(
    name ?? device.name, status ?? device.status, license_type ?? device.license_type,
    license_expires_at ?? device.license_expires_at, playlist_url ?? device.playlist_url,
    playlist_username ?? device.playlist_username, playlist_password ?? device.playlist_password,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete device
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.json({ success: true });
});

module.exports = router;
