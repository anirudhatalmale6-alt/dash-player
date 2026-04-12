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

module.exports = router;
