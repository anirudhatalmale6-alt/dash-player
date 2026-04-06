const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts' }
});
app.use('/api/auth/login', authLimiter);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/player', require('./routes/playerApi'));

// Serve frontend
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dash Player Admin Panel running on port ${PORT}`);
});
