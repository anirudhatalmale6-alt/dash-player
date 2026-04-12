const express = require('express');
const router = express.Router();
const db = require('../db');

// List departments (admin) - must come before /:id routes
router.get('/departments/all', (req, res) => {
  const departments = db.prepare('SELECT * FROM ticket_departments ORDER BY id ASC').all();
  res.json(departments);
});

// Create department (admin)
router.post('/departments', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required' });
  const result = db.prepare('INSERT INTO ticket_departments (name) VALUES (?)').run(name);
  res.json({ id: result.lastInsertRowid, name });
});

// Delete department (admin)
router.delete('/departments/:id', (req, res) => {
  db.prepare('DELETE FROM ticket_departments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// List all tickets (admin)
router.get('/', (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '';
  const params = [];
  if (status) {
    where = 'WHERE t.status = ?';
    params.push(status);
  }

  const tickets = db.prepare(`
    SELECT t.*, d.name AS department_name
    FROM tickets t
    LEFT JOIN ticket_departments d ON t.department_id = d.id
    ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM tickets t ${where}`).get(...params);

  res.json({ tickets, total: totalRow.count });
});

// Get single ticket (admin)
router.get('/:id', (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, d.name AS department_name
    FROM tickets t
    LEFT JOIN ticket_departments d ON t.department_id = d.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(ticket);
});

// Update ticket - reply and/or change status (admin)
router.put('/:id', (req, res) => {
  const { admin_reply, status } = req.body;
  const ticket = db.prepare('SELECT id, status FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const validStatuses = ['open', 'answered', 'closed'];
  const newStatus = validStatuses.includes(status) ? status : ticket.status;
  const newReply = admin_reply !== undefined ? admin_reply : '';

  db.prepare("UPDATE tickets SET admin_reply = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(newReply, newStatus, req.params.id);
  res.json({ success: true });
});

// Delete ticket (admin)
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
