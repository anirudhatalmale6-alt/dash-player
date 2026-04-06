const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connConfig = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };
  if (process.env.DB_SOCKET) {
    connConfig.socketPath = process.env.DB_SOCKET;
  } else {
    connConfig.host = process.env.DB_HOST || 'localhost';
    connConfig.port = process.env.DB_PORT || 3306;
  }
  const connection = await mysql.createConnection(connConfig);

  const dbName = process.env.DB_NAME || 'dash_player';

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  const schema = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('superadmin', 'admin', 'reseller') DEFAULT 'admin',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      max_connections INT DEFAULT 1,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bouquets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      xtream_bouquet_id INT DEFAULT NULL,
      category_type ENUM('live', 'vod', 'series') DEFAULT 'live',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS package_bouquets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      package_id INT NOT NULL,
      bouquet_id INT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (bouquet_id) REFERENCES bouquets(id) ON DELETE CASCADE,
      UNIQUE KEY unique_pkg_bouquet (package_id, bouquet_id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mac_address VARCHAR(17) NOT NULL,
      device_key VARCHAR(64) NOT NULL UNIQUE,
      device_name VARCHAR(255) DEFAULT NULL,
      device_type ENUM('android_tv', 'tizen', 'webos', 'windows', 'mag') DEFAULT 'android_tv',
      package_id INT DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      expiry_date DATETIME DEFAULT NULL,
      is_unlimited TINYINT(1) DEFAULT 0,
      last_activity DATETIME DEFAULT NULL,
      last_ip VARCHAR(45) DEFAULT NULL,
      notes TEXT,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
      INDEX idx_mac (mac_address),
      INDEX idx_device_key (device_key),
      INDEX idx_active_expiry (is_active, expiry_date)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      xtream_url VARCHAR(500) NOT NULL,
      xtream_username VARCHAR(255) NOT NULL,
      xtream_password VARCHAR(255) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_playlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      playlist_id INT NOT NULL,
      sort_order INT DEFAULT 0,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      UNIQUE KEY unique_device_playlist (device_id, playlist_id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT DEFAULT NULL,
      device_id INT DEFAULT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
      INDEX idx_created (created_at)
    );
  `;

  await connection.query(schema);

  // Insert default admin if not exists
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 12);
  await connection.query(
    `INSERT IGNORE INTO admins (username, password, role) VALUES ('admin', ?, 'superadmin')`,
    [hashedPassword]
  );

  console.log('Database migrated successfully!');
  console.log('Default admin: admin / admin123');
  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
