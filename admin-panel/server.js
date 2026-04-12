const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const authMiddleware = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public API Routes (no auth required)
app.use('/api', require('./routes/public'));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', authMiddleware, require('./routes/devices'));
app.use('/api/packages', authMiddleware, require('./routes/packages'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/settings', authMiddleware, require('./routes/settings'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));

// Player device auth (no admin JWT needed)
app.post('/api/player/auth', (req, res) => {
  const { mac_address, device_key } = req.body;
  if (!mac_address || !device_key) return res.status(400).json({ error: 'mac_address and device_key required' });

  const device = db.prepare('SELECT * FROM devices WHERE mac_address = ? AND device_key = ?').get(mac_address, device_key);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  if (device.status === 'blocked') return res.status(403).json({ error: 'Device is blocked' });

  // Check license expiry
  let licenseValid = true;
  if (device.license_type === 'trial') {
    const trialDays = db.prepare("SELECT value FROM settings WHERE key = 'trial_days'").get();
    const days = trialDays ? parseInt(trialDays.value) : 7;
    const created = new Date(device.created_at);
    const now = new Date();
    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (diffDays > days) licenseValid = false;
  } else if (device.license_type === 'yearly' && device.license_expires_at) {
    if (new Date(device.license_expires_at) < new Date()) licenseValid = false;
  }

  // Update last activity
  db.prepare('UPDATE devices SET updated_at = datetime("now") WHERE id = ?').run(device.id);

  res.json({
    status: device.status,
    license_type: device.license_type,
    license_valid: licenseValid,
    license_expires_at: device.license_expires_at,
    playlist_url: device.playlist_url,
    playlist_username: device.playlist_username,
    playlist_password: device.playlist_password,
    device_name: device.name,
  });
});

// Payment success/cancel pages
app.get('/payment/success', (req, res) => {
  res.send('<html><body style="background:#0a0a1a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1 style="color:#10b981">Payment Successful!</h1><p>Your license has been activated. You can close this page.</p></div></body></html>');
});
app.get('/payment/cancel', (req, res) => {
  res.send('<html><body style="background:#0a0a1a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1 style="color:#ef4444">Payment Cancelled</h1><p>No charges were made. You can close this page.</p></div></body></html>');
});

// Serve frontend static files (after building)
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Dash Player Admin Panel running on http://localhost:${PORT}`);
  console.log(`Default login: admin / admin123`);
});
