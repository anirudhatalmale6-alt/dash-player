const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [packages] = await pool.query(
      `SELECT p.*, COUNT(d.id) as device_count
       FROM packages p LEFT JOIN devices d ON p.id = d.package_id
       GROUP BY p.id ORDER BY p.name`
    );
    res.json({ packages });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [packages] = await pool.query('SELECT * FROM packages WHERE id = ?', [req.params.id]);
    if (!packages.length) return res.status(404).json({ error: 'Package not found' });

    const [bouquets] = await pool.query(
      `SELECT b.* FROM bouquets b
       JOIN package_bouquets pb ON b.id = pb.bouquet_id
       WHERE pb.package_id = ?`, [req.params.id]
    );

    res.json({ package: { ...packages[0], bouquets } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, description, max_connections, bouquet_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Package name required' });

    const [result] = await pool.query(
      'INSERT INTO packages (name, description, max_connections) VALUES (?, ?, ?)',
      [name, description || null, max_connections || 1]
    );

    if (bouquet_ids && bouquet_ids.length) {
      const values = bouquet_ids.map(bid => [result.insertId, bid]);
      await pool.query('INSERT INTO package_bouquets (package_id, bouquet_id) VALUES ?', [values]);
    }

    res.status(201).json({ id: result.insertId, message: 'Package created' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, description, max_connections, is_active, bouquet_ids } = req.body;
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (max_connections) { updates.push('max_connections = ?'); params.push(max_connections); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length) {
      params.push(req.params.id);
      await pool.query(`UPDATE packages SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (bouquet_ids !== undefined) {
      await pool.query('DELETE FROM package_bouquets WHERE package_id = ?', [req.params.id]);
      if (bouquet_ids.length) {
        const values = bouquet_ids.map(bid => [req.params.id, bid]);
        await pool.query('INSERT INTO package_bouquets (package_id, bouquet_id) VALUES ?', [values]);
      }
    }

    res.json({ message: 'Package updated' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM packages WHERE id = ?', [req.params.id]);
    res.json({ message: 'Package deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
