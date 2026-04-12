/* ============================================
   Dash Player - Public Website JavaScript
   API Base: https://management.dashplayer.eu/api
   ============================================ */

const API_BASE = 'https://management.dashplayer.eu/api';

// ---- State ----
let currentPlaylistMac = '';
let currentActivateMac = '';
let devicePlaylists = [];

// ---- DOM Ready ----
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  initNavbar();
  initPlaylistPage();
  initActivatePage();
});

// ============ Router ============

function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = (window.location.hash || '#home').replace('#', '');
  const validSections = ['home', 'playlist', 'activate'];
  const section = validSections.includes(hash) ? hash : 'home';

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const target = document.getElementById(section);
  if (target) {
    target.classList.add('active');
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-section') === section);
  });

  // Close mobile nav
  document.getElementById('navLinks')?.classList.remove('open');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ Navbar ============

function initNavbar() {
  // Mobile toggle
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => {
    links?.classList.toggle('open');
  });

  // Scroll shadow
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // Close mobile nav on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      links?.classList.remove('open');
    });
  });
}

// ============ Manage Playlist Page ============

function initPlaylistPage() {
  const form = document.getElementById('playlistLookupForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mac = document.getElementById('playlistMac').value.trim();
    if (!mac) return;
    currentPlaylistMac = mac;
    await lookupPlaylistDevice(mac);
  });

  const addForm = document.getElementById('addPlaylistForm');
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addPlaylist();
  });
}

async function lookupPlaylistDevice(mac) {
  showEl('playlistLookupLoading');
  hideEl('playlistLookupError');
  hideEl('playlistDeviceInfo');
  hideEl('addPlaylistSection');
  hideEl('currentPlaylists');

  try {
    const data = await apiGet(`/devices/${encodeURIComponent(mac)}`);

    // Show device info
    renderDeviceInfo('playlistDeviceDetails', 'playlistDeviceStatus', data);
    showEl('playlistDeviceInfo');

    // Load playlists
    await loadPlaylists(mac);

    // Show add playlist form
    showEl('addPlaylistSection');
    showEl('currentPlaylists');
  } catch (err) {
    showError('playlistLookupError', err.message || 'Device not found. Please check your MAC address.');
  } finally {
    hideEl('playlistLookupLoading');
  }
}

async function loadPlaylists(mac) {
  try {
    const data = await apiGet(`/devices/${encodeURIComponent(mac)}/playlists`);
    devicePlaylists = Array.isArray(data) ? data : (data.playlists || []);
    renderPlaylists();
  } catch (err) {
    devicePlaylists = [];
    renderPlaylists();
  }
}

function renderPlaylists() {
  const container = document.getElementById('playlistsList');
  const empty = document.getElementById('playlistsEmpty');

  if (!container) return;

  if (devicePlaylists.length === 0) {
    container.innerHTML = '';
    showEl('playlistsEmpty');
    return;
  }

  hideEl('playlistsEmpty');

  container.innerHTML = devicePlaylists.map((pl, i) => `
    <div class="playlist-item">
      <div class="playlist-item-info">
        <div class="playlist-url">${escapeHtml(pl.server_url || pl.url || pl.server || 'N/A')}</div>
        <div class="playlist-user">User: ${escapeHtml(pl.username || 'N/A')}</div>
      </div>
      <div class="playlist-item-actions">
        ${pl.is_default ? '<span class="playlist-default-badge">Default</span>' : `<button class="btn btn-sm btn-ghost" onclick="setDefaultPlaylist(${pl.id || i})"><i class="fas fa-star"></i> Set Default</button>`}
        <button class="btn btn-sm btn-danger" onclick="deletePlaylist(${pl.id || i})"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

async function addPlaylist() {
  const serverUrl = document.getElementById('playlistServerUrl').value.trim();
  const username = document.getElementById('playlistUsername').value.trim();
  const password = document.getElementById('playlistPassword').value.trim();

  if (!serverUrl || !username || !password) return;

  showEl('addPlaylistLoading');
  hideEl('addPlaylistError');
  hideEl('addPlaylistSuccess');

  try {
    await apiPost(`/devices/${encodeURIComponent(currentPlaylistMac)}/playlists`, {
      server_url: serverUrl,
      username: username,
      password: password
    });

    showSuccess('addPlaylistSuccess', 'Playlist added successfully!');

    // Clear form
    document.getElementById('playlistServerUrl').value = '';
    document.getElementById('playlistUsername').value = '';
    document.getElementById('playlistPassword').value = '';

    // Reload playlists
    await loadPlaylists(currentPlaylistMac);
  } catch (err) {
    showError('addPlaylistError', err.message || 'Failed to add playlist. Please try again.');
  } finally {
    hideEl('addPlaylistLoading');
  }
}

async function deletePlaylist(playlistId) {
  if (!confirm('Are you sure you want to delete this playlist?')) return;

  try {
    await apiDelete(`/devices/${encodeURIComponent(currentPlaylistMac)}/playlists/${playlistId}`);
    await loadPlaylists(currentPlaylistMac);
  } catch (err) {
    alert('Failed to delete playlist: ' + (err.message || 'Unknown error'));
  }
}

async function setDefaultPlaylist(playlistId) {
  try {
    await apiPut(`/devices/${encodeURIComponent(currentPlaylistMac)}/playlists/${playlistId}/default`);
    await loadPlaylists(currentPlaylistMac);
  } catch (err) {
    alert('Failed to set default: ' + (err.message || 'Unknown error'));
  }
}

// ============ Activation Page ============

function initActivatePage() {
  const form = document.getElementById('activateLookupForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mac = document.getElementById('activateMac').value.trim();
    if (!mac) return;
    currentActivateMac = mac;
    await lookupActivateDevice(mac);
  });
}

async function lookupActivateDevice(mac) {
  showEl('activateLookupLoading');
  hideEl('activateLookupError');
  hideEl('activateDeviceInfo');
  hideEl('packagesSection');

  try {
    const data = await apiGet(`/devices/${encodeURIComponent(mac)}`);

    renderDeviceInfo('activateDeviceDetails', 'activateDeviceStatus', data);
    showEl('activateDeviceInfo');

    // Show packages if expired or trial
    const status = (data.status || '').toLowerCase();
    if (status === 'expired' || status === 'trial' || status === 'inactive') {
      showEl('packagesSection');
    } else {
      // Still show packages so active users can renew early
      showEl('packagesSection');
    }
  } catch (err) {
    showError('activateLookupError', err.message || 'Device not found. Please check your MAC address.');
  } finally {
    hideEl('activateLookupLoading');
  }
}

async function handleRenew(packageType) {
  if (!currentActivateMac) {
    alert('Please look up your device first.');
    return;
  }

  showEl('renewLoading');

  try {
    const data = await apiPost('/checkout', {
      mac: currentActivateMac,
      package: packageType
    });

    // Redirect to payment URL
    if (data.checkout_url || data.url || data.redirect) {
      window.location.href = data.checkout_url || data.url || data.redirect;
    } else {
      alert('Payment checkout created. Please check your email for the payment link.');
    }
  } catch (err) {
    alert('Failed to create checkout: ' + (err.message || 'Please try again later.'));
  } finally {
    hideEl('renewLoading');
  }
}

// Make handleRenew available globally for onclick
window.handleRenew = handleRenew;

// ============ Device Info Renderer ============

function renderDeviceInfo(detailsId, statusId, data) {
  const statusEl = document.getElementById(statusId);
  const detailsEl = document.getElementById(detailsId);

  if (!statusEl || !detailsEl) return;

  const status = (data.status || 'unknown').toLowerCase();
  statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  statusEl.className = 'device-status';

  if (status === 'active') statusEl.classList.add('status-active');
  else if (status === 'expired' || status === 'inactive') statusEl.classList.add('status-expired');
  else if (status === 'trial') statusEl.classList.add('status-trial');
  else statusEl.classList.add('status-trial');

  const fields = [
    { label: 'MAC Address', value: data.mac || data.mac_address || 'N/A' },
    { label: 'Device Key', value: data.device_key || data.key || 'N/A' },
    { label: 'Expiry Date', value: formatDate(data.expiry_date || data.expires_at || data.expiry) },
    { label: 'Package', value: data.package || data.plan || 'N/A' },
    { label: 'Created', value: formatDate(data.created_at || data.created) },
    { label: 'Last Active', value: formatDate(data.last_active || data.last_seen) }
  ];

  detailsEl.innerHTML = fields.map(f => `
    <div class="detail-item">
      <span class="detail-label">${f.label}</span>
      <span class="detail-value">${escapeHtml(f.value)}</span>
    </div>
  `).join('');
}

// ============ API Helpers ============

async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Request failed (${res.status})`);
  }
  return res.json().catch(() => ({}));
}

// ============ Utilities ============

function showEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(message)}`;
    el.style.display = '';
  }
}

function showSuccess(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHtml(message)}`;
    el.style.display = '';
    // Auto-hide after 4s
    setTimeout(() => { if (el) el.style.display = 'none'; }, 4000);
  }
}

function escapeHtml(str) {
  if (!str) return 'N/A';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
