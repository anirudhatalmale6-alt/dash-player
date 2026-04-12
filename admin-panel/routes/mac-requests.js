const express = require('express');
const router = express.Router();
const db = require('../db');

// List all MAC change requests (with device info)
router.get('/', (req, res) => {
  const requests = db.prepare(`
    SELECT mcr.*, d.mac_address AS current_mac, d.name AS device_name, d.device_key AS current_device_key
    FROM mac_change_requests mcr
    LEFT JOIN devices d ON mcr.device_id = d.id
    ORDER BY mcr.created_at DESC
  `).all();
  res.json(requests);
});

// Approve MAC change request
router.post('/:id/approve', (req, res) => {
  const request = db.prepare('SELECT * FROM mac_change_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(request.device_id);
  if (!device) return res.status(404).json({ error: 'Associated device not found' });

  const approve = db.transaction(() => {
    db.prepare('UPDATE devices SET mac_address = ?, mac_changes_used = mac_changes_used + 1, updated_at = datetime("now") WHERE id = ?')
      .run(request.new_mac, request.device_id);
    db.prepare("UPDATE mac_change_requests SET status = 'approved' WHERE id = ?").run(req.params.id);
  });

  approve();
  res.json({ success: true, message: 'MAC change request approved', new_mac: request.new_mac });
});

// Reject MAC change request
router.post('/:id/reject', (req, res) => {
  const request = db.prepare('SELECT * FROM mac_change_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  db.prepare("UPDATE mac_change_requests SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ success: true, message: 'MAC change request rejected' });
});

module.exports = router;
