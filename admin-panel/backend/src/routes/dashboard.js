const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/stats', async (req, res) => {
  try {
    const [[totalDevices]] = await pool.query('SELECT COUNT(*) as count FROM devices');
    const [[activeDevices]] = await pool.query('SELECT COUNT(*) as count FROM devices WHERE is_active = 1');
    const [[expiredDevices]] = await pool.query(
      'SELECT COUNT(*) as count FROM devices WHERE is_unlimited = 0 AND expiry_date < NOW()'
    );
    const [[onlineDevices]] = await pool.query(
      'SELECT COUNT(*) as count FROM devices WHERE last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
    );
    const [[totalPackages]] = await pool.query('SELECT COUNT(*) as count FROM packages WHERE is_active = 1');
    const [[totalPlaylists]] = await pool.query('SELECT COUNT(*) as count FROM playlists WHERE is_active = 1');

    const [devicesByType] = await pool.query(
      'SELECT device_type, COUNT(*) as count FROM devices GROUP BY device_type'
    );

    const [recentActivity] = await pool.query(
      `SELECT al.*, a.username as admin_name, d.mac_address, d.device_name
       FROM activity_logs al
       LEFT JOIN admins a ON al.admin_id = a.id
       LEFT JOIN devices d ON al.device_id = d.id
       ORDER BY al.created_at DESC LIMIT 20`
    );

    const [expiringSoon] = await pool.query(
      `SELECT id, mac_address, device_name, device_type, expiry_date
       FROM devices WHERE is_unlimited = 0 AND expiry_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
       ORDER BY expiry_date LIMIT 10`
    );

    res.json({
      stats: {
        total_devices: totalDevices.count,
        active_devices: activeDevices.count,
        expired_devices: expiredDevices.count,
        online_devices: onlineDevices.count,
        total_packages: totalPackages.count,
        total_playlists: totalPlaylists.count
      },
      devices_by_type: devicesByType,
      recent_activity: recentActivity,
      expiring_soon: expiringSoon
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
