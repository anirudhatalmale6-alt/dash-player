const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'Dash Player',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#f7f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  // Load the built React app
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools();
  }

  // Fullscreen toggle with F11
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
    }
    if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });

  return win;
}

// IPC handlers for proxy/VPN
ipcMain.handle('set-proxy', async (event, config) => {
  try {
    // config: { protocol: 'socks5'|'http', server: string, port: string, username?: string, password?: string }
    let proxyUrl;
    if (config.username && config.password) {
      proxyUrl = `${config.protocol}://${config.username}:${config.password}@${config.server}:${config.port}`;
    } else {
      proxyUrl = `${config.protocol}://${config.server}:${config.port}`;
    }
    await session.defaultSession.setProxy({ proxyRules: proxyUrl });
    console.log('Proxy set:', proxyUrl.replace(/:[^:@]+@/, ':***@'));
    return { success: true };
  } catch (err) {
    console.error('Failed to set proxy:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clear-proxy', async () => {
  try {
    await session.defaultSession.setProxy({ proxyRules: '' });
    console.log('Proxy cleared');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Set app user model ID for Windows
app.setAppUserModelId('tv.dashplayer.app');
