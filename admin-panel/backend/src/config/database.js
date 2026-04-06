const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dash_player',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

if (process.env.DB_SOCKET) {
  config.socketPath = process.env.DB_SOCKET;
} else {
  config.host = process.env.DB_HOST || 'localhost';
  config.port = process.env.DB_PORT || 3306;
}

const pool = mysql.createPool(config);

module.exports = pool;
