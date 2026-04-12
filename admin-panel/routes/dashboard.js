const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/stats', (req, res) => {
  const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
  const activeDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'active'").get().count;
  const blockedDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'blocked'").get().count;
  const trialDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE license_type = 'trial'").get().count;
  const yearlyDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE license_type = 'yearly'").get().count;
  const unlimitedDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE license_type = 'unlimited'").get().count;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'").get().total;
  const totalPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'completed'").get().count;
  const pendingPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get().count;

  const recentDevices = db.prepare('SELECT id, mac_address, name, status, license_type, created_at FROM devices ORDER BY created_at DESC LIMIT 5').all();
  const recentPayments = db.prepare(`
    SELECT p.*, d.mac_address, d.name as device_name, pkg.name as package_name
    FROM payments p
    LEFT JOIN devices d ON p.device_id = d.id
    LEFT JOIN packages pkg ON p.package_id = pkg.id
    ORDER BY p.created_at DESC LIMIT 5
  `).all();

  res.json({
    totalDevices, activeDevices, blockedDevices,
    trialDevices, yearlyDevices, unlimitedDevices,
    totalRevenue, totalPayments, pendingPayments,
    recentDevices, recentPayments,
  });
});

module.exports = router;
