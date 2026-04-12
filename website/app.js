/* ============================================
   Dash Player - Public Website JavaScript
   API Base: https://management.dashplayer.eu/api
   ============================================ */

const API_BASE = '/api';

// ---- State ----
let currentPlaylistMac = '';
let currentPlaylistKey = '';
let currentActivateMac = '';
let currentActivateKey = '';
let devicePlaylists = [];
let tosLoaded = false;
let privacyLoaded = false;

// ---- DOM Ready ----
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  initNavbar();
  initPlaylistPage();
  initActivatePage();
  initMacChangePage();
  initSupportPage();
});

// ============ Router ============

function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const rawHash = (window.location.hash || '#home').replace('#', '');
  // Parse section and query params from hash (e.g. activate?mac=XX&key=YY)
  const [section_raw, queryString] = rawHash.split('?');
  const validSections = ['home', 'playlist', 'activate', 'mac-change', 'support', 'tos', 'privacy'];
  const section = validSections.includes(section_raw) ? section_raw : 'home';

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

  // Auto-fill activate form from URL params
  if (section === 'activate' && queryString) {
    const params = new URLSearchParams(queryString);
    const mac = params.get('mac');
    const key = params.get('key');
    if (mac) {
      const macInput = document.getElementById('activateMac');
      if (macInput) macInput.value = decodeURIComponent(mac);
    }
    if (key) {
      const keyInput = document.getElementById('activateDeviceKey');
      if (keyInput) keyInput.value = decodeURIComponent(key);
    }
    // Auto-submit lookup if both fields are filled
    if (mac && key) {
      currentActivateMac = decodeURIComponent(mac);
      currentActivateKey = decodeURIComponent(key);
      lookupActivateDevice(currentActivateMac, currentActivateKey);
    }
  }

  // Load TOS/Privacy lazily on first visit
  if (section === 'tos' && !tosLoaded) {
    tosLoaded = true;
    loadLegalPage('tos', 'tosContent');
  }
  if (section === 'privacy' && !privacyLoaded) {
    privacyLoaded = true;
    loadLegalPage('privacy', 'privacyContent');
  }

  // Auto-fill playlist form from URL params
  if (section === 'playlist' && queryString) {
    const params = new URLSearchParams(queryString);
    const mac = params.get('mac');
    const key = params.get('key');
    if (mac) {
      const macInput = document.getElementById('playlistMac');
      if (macInput) macInput.value = decodeURIComponent(mac);
    }
    if (key) {
      const keyInput = document.getElementById('playlistDeviceKey');
      if (keyInput) keyInput.value = decodeURIComponent(key);
    }
    if (mac && key) {
      currentPlaylistMac = decodeURIComponent(mac);
      currentPlaylistKey = decodeURIComponent(key);
      lookupPlaylistDevice(currentPlaylistMac, currentPlaylistKey);
    }
  }

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
    const key = document.getElementById('playlistDeviceKey').value.trim();
    if (!mac || !key) return;
    currentPlaylistMac = mac;
    currentPlaylistKey = key;
    await lookupPlaylistDevice(mac, key);
  });

  const addForm = document.getElementById('addPlaylistForm');
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addPlaylist();
  });
}

async function lookupPlaylistDevice(mac, key) {
  showEl('playlistLookupLoading');
  hideEl('playlistLookupError');
  hideEl('playlistDeviceInfo');
  hideEl('addPlaylistSection');
  hideEl('currentPlaylists');

  try {
    const data = await apiPost('/device/lookup', { mac_address: mac, device_key: key });

    // Show device info
    renderDeviceInfo('playlistDeviceDetails', 'playlistDeviceStatus', data.device);
    showEl('playlistDeviceInfo');

    // Store playlists from lookup response
    devicePlaylists = Array.isArray(data.playlists) ? data.playlists : [];
    renderPlaylists();

    // Show add playlist form
    showEl('addPlaylistSection');
    showEl('currentPlaylists');
  } catch (err) {
    showError('playlistLookupError', err.message || 'Device not found. Please check your MAC address.');
  } finally {
    hideEl('playlistLookupLoading');
  }
}

async function reloadPlaylists() {
  try {
    const data = await apiPost('/device/lookup', { mac_address: currentPlaylistMac, device_key: currentPlaylistKey });
    devicePlaylists = Array.isArray(data.playlists) ? data.playlists : [];
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
        <div class="playlist-name" style="font-weight:600;margin-bottom:2px;">${escapeHtml(pl.name || 'My Playlist')}</div>
        <div class="playlist-url">${escapeHtml(pl.server_url || pl.url || pl.server || 'N/A')}</div>
        <div class="playlist-user">User: ${escapeHtml(pl.username || 'N/A')} | Format: ${(pl.output_format || 'm3u8') === 'ts' ? 'MPEG-TS' : 'HLS (M3U8)'}</div>
      </div>
      <div class="playlist-item-actions">
        ${pl.is_default ? '<span class="playlist-default-badge">Default</span>' : `<button class="btn btn-sm btn-ghost" onclick="setDefaultPlaylist(${pl.id || i})"><i class="fas fa-star"></i> Set Default</button>`}
        <button class="btn btn-sm btn-danger" onclick="deletePlaylist(${pl.id || i})"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

async function addPlaylist() {
  const playlistName = document.getElementById('playlistName').value.trim();
  const serverUrl = document.getElementById('playlistServerUrl').value.trim();
  const username = document.getElementById('playlistUsername').value.trim();
  const password = document.getElementById('playlistPassword').value.trim();
  const outputFormat = document.getElementById('playlistOutputFormat').value;

  if (!serverUrl || !username || !password) return;

  showEl('addPlaylistLoading');
  hideEl('addPlaylistError');
  hideEl('addPlaylistSuccess');

  try {
    await apiPost('/device/playlists', {
      mac_address: currentPlaylistMac,
      device_key: currentPlaylistKey,
      name: playlistName || 'My Playlist',
      server_url: serverUrl,
      username: username,
      password: password,
      output_format: outputFormat
    });

    showSuccess('addPlaylistSuccess', 'Playlist added successfully!');

    // Clear form
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistServerUrl').value = '';
    document.getElementById('playlistUsername').value = '';
    document.getElementById('playlistPassword').value = '';
    document.getElementById('playlistOutputFormat').value = 'm3u8';

    // Reload playlists
    await reloadPlaylists();
  } catch (err) {
    showError('addPlaylistError', err.message || 'Failed to add playlist. Please try again.');
  } finally {
    hideEl('addPlaylistLoading');
  }
}

async function deletePlaylist(playlistId) {
  if (!confirm('Are you sure you want to delete this playlist?')) return;

  try {
    await apiDelete(`/device/playlists/${playlistId}`, { mac_address: currentPlaylistMac, device_key: currentPlaylistKey });
    await reloadPlaylists();
  } catch (err) {
    alert('Failed to delete playlist: ' + (err.message || 'Unknown error'));
  }
}

async function setDefaultPlaylist(playlistId) {
  try {
    await apiPost(`/device/playlists/${playlistId}/default`, { mac_address: currentPlaylistMac, device_key: currentPlaylistKey });
    await reloadPlaylists();
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
    const key = document.getElementById('activateDeviceKey').value.trim();
    if (!mac || !key) return;
    currentActivateMac = mac;
    currentActivateKey = key;
    await lookupActivateDevice(mac, key);
  });
}

async function lookupActivateDevice(mac, key) {
  showEl('activateLookupLoading');
  hideEl('activateLookupError');
  hideEl('activateDeviceInfo');
  hideEl('packagesSection');

  try {
    const data = await apiPost('/device/lookup', { mac_address: mac, device_key: key });

    renderDeviceInfo('activateDeviceDetails', 'activateDeviceStatus', data.device);
    showEl('activateDeviceInfo');

    // Show packages if expired or trial
    const devStatus = (data.device.status || data.device.license_type || '').toLowerCase();
    const devExpiry = data.device.license_expires_at || data.device.expiry_date || data.device.expires_at;
    const isExpired = devExpiry && new Date(devExpiry) < new Date();
    if (isExpired || devStatus === 'expired' || devStatus === 'trial' || devStatus === 'inactive') {
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

// ============ MAC Change Page ============

function initMacChangePage() {
  const form = document.getElementById('macChangeForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleMacChange();
  });
}

async function handleMacChange() {
  const oldMac = document.getElementById('macChangeOldMac').value.trim();
  const deviceKey = document.getElementById('macChangeDeviceKey').value.trim();
  const newMac = document.getElementById('macChangeNewMac').value.trim();

  if (!oldMac || !deviceKey || !newMac) return;

  showEl('macChangeLoading');
  hideEl('macChangeError');
  hideEl('macChangeSuccess');

  try {
    await apiPost('/device/mac-change', {
      old_mac: oldMac,
      device_key: deviceKey,
      new_mac: newMac
    });

    showSuccess('macChangeSuccess', 'MAC change request submitted successfully! Your device will be updated shortly.');

    // Clear form
    document.getElementById('macChangeOldMac').value = '';
    document.getElementById('macChangeDeviceKey').value = '';
    document.getElementById('macChangeNewMac').value = '';
  } catch (err) {
    showError('macChangeError', err.message || 'Failed to submit MAC change request. Please check your details and try again.');
  } finally {
    hideEl('macChangeLoading');
  }
}

// ============ Support / Tickets Page ============

function initSupportPage() {
  // Load departments into dropdown
  loadDepartments();

  const form = document.getElementById('supportTicketForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleTicketSubmit();
  });
}

async function loadDepartments() {
  try {
    const depts = await apiGet('/departments');
    const select = document.getElementById('ticketDepartment');
    if (!select) return;
    if (!depts || depts.length === 0) {
      select.innerHTML = '<option value="">No departments available</option>';
      return;
    }
    select.innerHTML = '<option value="">Select a department</option>' +
      depts.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  } catch (err) {
    const select = document.getElementById('ticketDepartment');
    if (select) select.innerHTML = '<option value="">Failed to load departments</option>';
  }
}

async function handleTicketSubmit() {
  const mac = document.getElementById('ticketMac')?.value.trim() || '';
  const deviceKey = document.getElementById('ticketDeviceKey')?.value.trim() || '';
  const departmentId = document.getElementById('ticketDepartment')?.value || null;
  const subject = document.getElementById('ticketSubject')?.value.trim() || '';
  const message = document.getElementById('ticketMessage')?.value.trim() || '';

  if (!subject || !message) return;

  showEl('ticketLoading');
  hideEl('ticketError');
  hideEl('ticketSuccess');

  try {
    const data = await apiPost('/tickets', {
      device_mac: mac,
      device_key: deviceKey,
      department_id: departmentId ? parseInt(departmentId) : null,
      subject,
      message
    });

    showSuccess('ticketSuccess', data.message || 'Ticket submitted successfully! Reference #' + (data.ticket_id || ''));

    // Clear form
    document.getElementById('ticketMac').value = '';
    document.getElementById('ticketDeviceKey').value = '';
    document.getElementById('ticketDepartment').value = '';
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketMessage').value = '';
  } catch (err) {
    showError('ticketError', err.message || 'Failed to submit ticket. Please try again.');
  } finally {
    hideEl('ticketLoading');
  }
}

// ============ TOS / Privacy Page ============

async function loadLegalPage(type, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const data = await apiGet('/pages/' + type);
    if (data.content && data.content.trim()) {
      el.innerHTML = data.content;
    } else {
      el.innerHTML = '<p style="color:#6b7280;text-align:center;padding:2rem;">Content coming soon.</p>';
    }
  } catch (err) {
    el.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Failed to load content. Please try again later.</p>';
  }
}

// ============ Device Info Renderer ============

function renderDeviceInfo(detailsId, statusId, data) {
  const statusEl = document.getElementById(statusId);
  const detailsEl = document.getElementById(detailsId);

  if (!statusEl || !detailsEl) return;

  // Derive status from license_type and expiry
  let status = (data.status || data.license_type || 'unknown').toLowerCase();
  const expiresAt = data.license_expires_at || data.expiry_date || data.expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    status = 'expired';
  }
  statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  statusEl.className = 'device-status';

  if (status === 'active' || status === 'lifetime') statusEl.classList.add('status-active');
  else if (status === 'expired' || status === 'inactive') statusEl.classList.add('status-expired');
  else if (status === 'trial') statusEl.classList.add('status-trial');
  else statusEl.classList.add('status-trial');

  const fields = [
    { label: 'MAC Address', value: data.mac_address || data.mac || 'N/A' },
    { label: 'Device Key', value: data.device_key || data.key || 'N/A' },
    { label: 'License Type', value: data.license_type || data.package || data.plan || 'N/A' },
    { label: 'Expiry Date', value: formatDate(data.license_expires_at || data.expiry_date || data.expires_at) },
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

async function apiDelete(path, body) {
  const headers = { 'Accept': 'application/json' };
  const opts = { method: 'DELETE', headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + path, opts);
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
