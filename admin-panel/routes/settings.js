const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  for (const s of settings) obj[s.key] = s.value;
  res.json(obj);
});

router.put('/', (req, res) => {
  const updates = req.body;
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');

  const transaction = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, value, value);
    }
  });

  transaction(Object.entries(updates));
  res.json({ success: true });
});

// Get VAT settings
router.get('/vat', (req, res) => {
  const vatEnabled = db.prepare("SELECT value FROM settings WHERE key = 'vat_enabled'").get();
  const vatRate = db.prepare("SELECT value FROM settings WHERE key = 'vat_rate'").get();
  res.json({
    vat_enabled: vatEnabled ? parseInt(vatEnabled.value) : 0,
    vat_rate: vatRate ? parseFloat(vatRate.value) : 0,
  });
});

// Update VAT settings
router.put('/vat', (req, res) => {
  const { vat_enabled, vat_rate } = req.body;
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');

  if (vat_enabled !== undefined) {
    const val = String(vat_enabled ? 1 : 0);
    upsert.run('vat_enabled', val, val);
  }
  if (vat_rate !== undefined) {
    const val = String(vat_rate);
    upsert.run('vat_rate', val, val);
  }

  res.json({ success: true });
});

module.exports = router;
