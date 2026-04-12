const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const packages = db.prepare('SELECT * FROM packages ORDER BY price ASC').all();
  res.json(packages);
});

router.get('/:id', (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  res.json(pkg);
});

router.post('/', (req, res) => {
  const { name, description, license_type, duration_days, price, currency, stripe_price_id, mollie_description, is_active } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });

  const result = db.prepare(
    'INSERT INTO packages (name, description, license_type, duration_days, price, currency, stripe_price_id, mollie_description, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, description || '', license_type || 'yearly', duration_days || 365, price, currency || 'EUR', stripe_price_id || '', mollie_description || '', is_active ?? 1);

  res.status(201).json(db.prepare('SELECT * FROM packages WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { name, description, license_type, duration_days, price, currency, stripe_price_id, mollie_description, is_active } = req.body;
  db.prepare(
    'UPDATE packages SET name = ?, description = ?, license_type = ?, duration_days = ?, price = ?, currency = ?, stripe_price_id = ?, mollie_description = ?, is_active = ? WHERE id = ?'
  ).run(
    name ?? pkg.name, description ?? pkg.description, license_type ?? pkg.license_type,
    duration_days ?? pkg.duration_days, price ?? pkg.price, currency ?? pkg.currency,
    stripe_price_id ?? pkg.stripe_price_id, mollie_description ?? pkg.mollie_description,
    is_active ?? pkg.is_active, req.params.id
  );

  res.json(db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM packages WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Package not found' });
  res.json({ success: true });
});

module.exports = router;
