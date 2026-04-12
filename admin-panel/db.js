const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'dashplayer.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'manager')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT NOT NULL,
    device_key TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'blocked', 'expired', 'trial')),
    license_type TEXT DEFAULT 'trial' CHECK(license_type IN ('trial', 'yearly', 'unlimited')),
    license_expires_at TEXT,
    playlist_url TEXT DEFAULT '',
    playlist_username TEXT DEFAULT '',
    playlist_password TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    license_type TEXT DEFAULT 'yearly' CHECK(license_type IN ('yearly', 'unlimited')),
    duration_days INTEGER DEFAULT 365,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    stripe_price_id TEXT DEFAULT '',
    mollie_description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    package_id INTEGER,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    provider TEXT CHECK(provider IN ('stripe', 'mollie')),
    provider_payment_id TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    name TEXT DEFAULT 'My Playlist',
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    output_format TEXT DEFAULT 'm3u8',
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mac_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    old_mac TEXT NOT NULL,
    new_mac TEXT NOT NULL,
    device_key TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac_address);
  CREATE INDEX IF NOT EXISTS idx_devices_key ON devices(device_key);
  CREATE INDEX IF NOT EXISTS idx_payments_device ON payments(device_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  CREATE INDEX IF NOT EXISTS idx_playlists_device ON playlists(device_id);
  CREATE INDEX IF NOT EXISTS idx_mac_requests_device ON mac_change_requests(device_id);
  CREATE INDEX IF NOT EXISTS idx_mac_requests_status ON mac_change_requests(status);
`);

// Add new columns to devices table if they don't exist
try { db.exec('ALTER TABLE devices ADD COLUMN mac_change_limit INTEGER DEFAULT 1'); } catch (e) { /* column exists */ }
try { db.exec('ALTER TABLE devices ADD COLUMN mac_changes_used INTEGER DEFAULT 0'); } catch (e) { /* column exists */ }
try { db.exec('ALTER TABLE devices ADD COLUMN is_banned INTEGER DEFAULT 0'); } catch (e) { /* column exists */ }
try { db.exec("ALTER TABLE playlists ADD COLUMN output_format TEXT DEFAULT 'm3u8'"); } catch (e) { /* column exists */ }

// Insert default settings if not exist
const defaultSettings = [
  ['trial_days', '7'],
  ['stripe_secret_key', ''],
  ['stripe_webhook_secret', ''],
  ['mollie_api_key', ''],
  ['stripe_enabled', 'false'],
  ['mollie_enabled', 'false'],
  ['payment_enabled', 'false'],
  ['app_name', 'Dash Player'],
  ['support_url', 'https://panel.dashplayer.tv'],
  ['vat_enabled', '0'],
  ['vat_rate', '0'],
];

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

// Insert default admin if not exists
const existingAdmin = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('Default admin created: admin / admin123');
}

// Insert default packages if none exist
const pkgCount = db.prepare('SELECT COUNT(*) as count FROM packages').get();
if (pkgCount.count === 0) {
  db.prepare('INSERT INTO packages (name, description, license_type, duration_days, price, currency) VALUES (?, ?, ?, ?, ?, ?)').run(
    'Yearly License', '1 year access to Dash Player on one device', 'yearly', 365, 29.99, 'EUR'
  );
  db.prepare('INSERT INTO packages (name, description, license_type, duration_days, price, currency) VALUES (?, ?, ?, ?, ?, ?)').run(
    'Lifetime License', 'Unlimited lifetime access on one device', 'unlimited', 0, 59.99, 'EUR'
  );
}

module.exports = db;
