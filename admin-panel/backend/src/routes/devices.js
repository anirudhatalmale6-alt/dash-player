const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// List devices with filtering & pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, search, status, device_type, package_id } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];

    if (search) {
      where.push('(d.mac_address LIKE ? OR d.device_key LIKE ? OR d.device_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status === 'active') { where.push('d.is_active = 1'); }
    if (status === 'inactive') { where.push('d.is_active = 0'); }
    if (status === 'expired') { where.push('d.is_unlimited = 0 AND d.expiry_date < NOW()'); }
    if (device_type) { where.push('d.device_type = ?'); params.push(device_type); }
    if (package_id) { where.push('d.package_id = ?'); params.push(package_id); }

    const whereClause = where.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM devices d WHERE ${whereClause}`, params
    );

    const [devices] = await pool.query(
      `SELECT d.*, p.name as package_name, a.username as created_by_name
       FROM devices d
       LEFT JOIN packages p ON d.package_id = p.id
       LEFT JOIN admins a ON d.created_by = a.id
       WHERE ${whereClause}
       ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      devices,
      pagination: {
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRows[0].total / limit)
      }
    });
  } catch (err) {
    console.error('List devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single device with playlists
router.get('/:id', async (req, res) => {
  try {
    const [devices] = await pool.query(
      `SELECT d.*, p.name as package_name
       FROM devices d LEFT JOIN packages p ON d.package_id = p.id
       WHERE d.id = ?`, [req.params.id]
    );
    if (!devices.length) return res.status(404).json({ error: 'Device not found' });

    const [playlists] = await pool.query(
      `SELECT pl.*, dp.sort_order FROM playlists pl
       JOIN device_playlists dp ON pl.id = dp.playlist_id
       WHERE dp.device_id = ? ORDER BY dp.sort_order`, [req.params.id]
    );

    res.json({ device: { ...devices[0], playlists } });
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create device
router.post('/', async (req, res) => {
  try {
    const { mac_address, device_name, device_type, package_id, expiry_type, expiry_date, notes, playlist_ids } = req.body;

    if (!mac_address) return res.status(400).json({ error: 'MAC address is required' });

    const deviceKey = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
    const isUnlimited = expiry_type === 'unlimited' ? 1 : 0;

    let finalExpiry = null;
    if (!isUnlimited) {
      if (expiry_type === '1year') {
        finalExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      } else if (expiry_date) {
        finalExpiry = new Date(expiry_date);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO devices (mac_address, device_key, device_name, device_type, package_id, is_unlimited, expiry_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mac_address, deviceKey, device_name || null, device_type || 'android_tv', package_id || null, isUnlimited, finalExpiry, notes || null, req.admin.id]
    );

    // Assign playlists
    if (playlist_ids && playlist_ids.length) {
      const values = playlist_ids.map((pid, i) => [result.insertId, pid, i]);
      await pool.query('INSERT INTO device_playlists (device_id, playlist_id, sort_order) VALUES ?', [values]);
    }

    await pool.query(
      'INSERT INTO activity_logs (admin_id, device_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, result.insertId, 'device_created', `MAC: ${mac_address}, Key: ${deviceKey}`, req.ip]
    );

    res.status(201).json({ id: result.insertId, device_key: deviceKey, message: 'Device created' });
  } catch (err) {
    console.error('Create device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update device
router.put('/:id', async (req, res) => {
  try {
    const { mac_address, device_name, device_type, package_id, is_active, expiry_type, expiry_date, notes, playlist_ids } = req.body;

    const updates = [];
    const params = [];

    if (mac_address !== undefined) { updates.push('mac_address = ?'); params.push(mac_address); }
    if (device_name !== undefined) { updates.push('device_name = ?'); params.push(device_name); }
    if (device_type !== undefined) { updates.push('device_type = ?'); params.push(device_type); }
    if (package_id !== undefined) { updates.push('package_id = ?'); params.push(package_id || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (expiry_type === 'unlimited') {
      updates.push('is_unlimited = 1', 'expiry_date = NULL');
    } else if (expiry_type === '1year') {
      updates.push('is_unlimited = 0', 'expiry_date = ?');
      params.push(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    } else if (expiry_date) {
      updates.push('is_unlimited = 0', 'expiry_date = ?');
      params.push(new Date(expiry_date));
    }

    if (updates.length) {
      params.push(req.params.id);
      await pool.query(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Update playlists
    if (playlist_ids !== undefined) {
      await pool.query('DELETE FROM device_playlists WHERE device_id = ?', [req.params.id]);
      if (playlist_ids.length) {
        const values = playlist_ids.map((pid, i) => [req.params.id, pid, i]);
        await pool.query('INSERT INTO device_playlists (device_id, playlist_id, sort_order) VALUES ?', [values]);
      }
    }

    await pool.query(
      'INSERT INTO activity_logs (admin_id, device_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, req.params.id, 'device_updated', JSON.stringify(req.body), req.ip]
    );

    res.json({ message: 'Device updated' });
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete device
router.delete('/:id', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM devices WHERE id = ?', [req.params.id]);
    await pool.query(
      'INSERT INTO activity_logs (admin_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [req.admin.id, 'device_deleted', `Device ID: ${req.params.id}`, req.ip]
    );
    res.json({ message: 'Device deleted' });
  } catch (err) {
    console.error('Delete device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change MAC address (for TV replacement)
router.put('/:id/change-mac', async (req, res) => {
  try {
    const { new_mac_address } = req.body;
    if (!new_mac_address) return res.status(400).json({ error: 'New MAC address required' });

    const [device] = await pool.query('SELECT mac_address FROM devices WHERE id = ?', [req.params.id]);
    if (!device.length) return res.status(404).json({ error: 'Device not found' });

    const oldMac = device[0].mac_address;
    await pool.query('UPDATE devices SET mac_address = ? WHERE id = ?', [new_mac_address, req.params.id]);

    await pool.query(
      'INSERT INTO activity_logs (admin_id, device_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, req.params.id, 'mac_changed', `Old: ${oldMac} -> New: ${new_mac_address}`, req.ip]
    );

    res.json({ message: 'MAC address updated', old_mac: oldMac, new_mac: new_mac_address });
  } catch (err) {
    console.error('Change MAC error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Device authentication endpoint (used by player apps)
router.post('/authenticate', async (req, res) => {
  try {
    // This endpoint doesn't require admin auth
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
