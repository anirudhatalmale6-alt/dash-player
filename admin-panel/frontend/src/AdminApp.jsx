import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/* ─────────────── API Setup ─────────────── */
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('dash_admin_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('dash_admin_token');
    window.location.reload();
  }
  return Promise.reject(err);
});

/* ─────────────── Toast System ─────────────── */
let toastId = 0;
let setToastsGlobal = null;

function showToast(message, type = 'success') {
  if (!setToastsGlobal) return;
  const id = ++toastId;
  setToastsGlobal(prev => [...prev, { id, message, type }]);
  setTimeout(() => {
    setToastsGlobal(prev => prev.filter(t => t.id !== id));
  }, 3500);
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  setToastsGlobal = setToasts;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === 'success' ? '\u2713' : '\u2717'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Modal ─────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────── Confirm Dialog ─────────────── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#9888;</div>
          <p style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>{message}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Login Page ─────────────── */
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('dash_admin_token', data.token);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">&#9655;</div>
          <h1>Dash Player</h1>
          <p className="login-subtitle">Admin Panel</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────── Dashboard Page ─────────────── */
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(() => showToast('Failed to load dashboard', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading dashboard...</div>;
  if (!stats) return <div className="page-loading">Failed to load data</div>;

  const cards = [
    { label: 'Total Devices', value: stats.totalDevices ?? 0, icon: '\uD83D\uDCF1' },
    { label: 'Active Devices', value: stats.activeDevices ?? 0, icon: '\u2705' },
    { label: 'Total Revenue', value: `$${(stats.totalRevenue ?? 0).toFixed(2)}`, icon: '\uD83D\uDCB0' },
    { label: 'Active Subscriptions', value: stats.activeSubscriptions ?? 0, icon: '\uD83D\uDD11' },
  ];

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>
      <div className="stats-grid">
        {cards.map((c, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-info">
              <span className="stat-value">{c.value}</span>
              <span className="stat-label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h3 className="card-title">Recent Payments</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Device</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recentPayments || []).length === 0 ? (
                  <tr><td colSpan="4" className="empty-cell">No payments yet</td></tr>
                ) : stats.recentPayments.map((p, i) => (
                  <tr key={i}>
                    <td>{new Date(p.created_at || p.date).toLocaleDateString()}</td>
                    <td>{p.device_name || p.mac_address || '-'}</td>
                    <td>${Number(p.amount || 0).toFixed(2)}</td>
                    <td><span className={`badge badge-${p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'default'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Recent Devices</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MAC</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recentDevices || []).length === 0 ? (
                  <tr><td colSpan="4" className="empty-cell">No devices yet</td></tr>
                ) : stats.recentDevices.map((d, i) => (
                  <tr key={i}>
                    <td className="mono">{d.mac_address}</td>
                    <td>{d.name || '-'}</td>
                    <td><span className={`badge badge-${d.status === 'active' ? 'success' : d.status === 'trial' ? 'warning' : 'default'}`}>{d.status}</span></td>
                    <td>{d.license_expires_at ? new Date(d.license_expires_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Devices Page ─────────────── */
function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const limit = 20;

  const fetchDevices = useCallback(() => {
    setLoading(true);
    api.get('/devices', { params: { page, search, limit } })
      .then(r => {
        setDevices(r.data.devices || r.data.data || r.data || []);
        setTotal(r.data.total ?? r.data.totalCount ?? 0);
      })
      .catch(() => showToast('Failed to load devices', 'error'))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleSave = async (formData) => {
    try {
      if (editDevice) {
        await api.put(`/devices/${editDevice.id}`, formData);
        showToast('Device updated');
      } else {
        await api.post('/devices', formData);
        showToast('Device added');
      }
      setShowModal(false);
      setEditDevice(null);
      fetchDevices();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save device', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/devices/${confirmDelete.id}`);
      showToast('Device deleted');
      setConfirmDelete(null);
      fetchDevices();
    } catch {
      showToast('Failed to delete device', 'error');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Devices</h2>
        <button className="btn btn-primary" onClick={() => { setEditDevice(null); setShowModal(true); }}>+ Add Device</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by MAC, name, or key..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MAC Address</th>
                <th>Device Key</th>
                <th>Name</th>
                <th>Status</th>
                <th>License</th>
                <th>Expires</th>
                <th>Playlist URL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="empty-cell">Loading...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan="8" className="empty-cell">No devices found</td></tr>
              ) : devices.map(d => (
                <tr key={d.id}>
                  <td className="mono">{d.mac_address}</td>
                  <td className="mono" style={{fontSize:'0.8em'}}>{d.device_key || '-'}</td>
                  <td>{d.name || '-'}</td>
                  <td><span className={`badge badge-${d.status === 'active' ? 'success' : d.status === 'trial' ? 'warning' : d.status === 'expired' ? 'danger' : 'default'}`}>{d.status}</span></td>
                  <td>{d.license_type || '-'}</td>
                  <td>{d.license_expires_at ? new Date(d.license_expires_at).toLocaleDateString() : '-'}</td>
                  <td className="mono" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.playlist_url || '-'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm btn-ghost" onClick={() => { setEditDevice(d); setShowModal(true); }}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(d)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span className="page-info">Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {showModal && (
        <DeviceFormModal
          device={editDevice}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditDevice(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete device "${confirmDelete.mac_address || confirmDelete.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function DeviceFormModal({ device, onSave, onClose }) {
  const [form, setForm] = useState({
    mac_address: device?.mac_address || '',
    name: device?.name || '',
    status: device?.status || 'trial',
    license_type: device?.license_type || 'yearly',
    license_expires_at: device?.license_expires_at ? device.license_expires_at.substring(0, 10) : '',
    playlist_url: device?.playlist_url || '',
    playlist_username: device?.playlist_username || '',
    playlist_password: device?.playlist_password || '',
  });
  const [saving, setSaving] = useState(false);
  const [changeMac, setChangeMac] = useState(false);
  const [newMac, setNewMac] = useState('');
  const [macMsg, setMacMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    onSave(form).finally(() => setSaving(false));
  };

  const handleChangeMac = async () => {
    if (!newMac) return;
    try {
      await api.post(`/devices/${device.id}/change-mac`, { new_mac: newMac });
      setMacMsg('MAC changed successfully');
      set('mac_address', newMac);
      setChangeMac(false);
      setNewMac('');
    } catch (err) {
      setMacMsg(err.response?.data?.error || 'Failed to change MAC');
    }
  };

  const handleResetKey = async () => {
    try {
      const r = await api.post(`/devices/${device.id}/reset-key`);
      setMacMsg('Device key reset to: ' + r.data.device_key);
    } catch (err) {
      setMacMsg(err.response?.data?.error || 'Failed to reset key');
    }
  };

  return (
    <Modal title={device ? 'Edit Device' : 'Add Device'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>MAC Address</label>
            <input value={form.mac_address} onChange={e => set('mac_address', e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" required disabled={!!device} />
          </div>
          <div className="form-group">
            <label>Device Key</label>
            <input value={device?.device_key || 'Auto-generated'} readOnly style={{background:'#f3f4f6',cursor:'default'}} />
          </div>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Device name" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div className="form-group">
            <label>License Type</label>
            <select value={form.license_type} onChange={e => set('license_type', e.target.value)}>
              <option value="trial">Trial</option>
              <option value="yearly">Yearly</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>
          <div className="form-group">
            <label>License Expires</label>
            <input type="date" value={form.license_expires_at} onChange={e => set('license_expires_at', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Playlist URL</label>
            <input value={form.playlist_url} onChange={e => set('playlist_url', e.target.value)} placeholder="http://provider.com:8080" />
          </div>
          <div className="form-group">
            <label>Playlist Username</label>
            <input value={form.playlist_username} onChange={e => set('playlist_username', e.target.value)} placeholder="Username" />
          </div>
          <div className="form-group">
            <label>Playlist Password</label>
            <input value={form.playlist_password} onChange={e => set('playlist_password', e.target.value)} placeholder="Password" />
          </div>
        </div>

        {device && (
          <div style={{margin:'16px 0',padding:'12px',background:'#f8f7fc',borderRadius:8}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:macMsg?8:0}}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChangeMac(!changeMac)}>Change MAC</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleResetKey}>Reset Device Key</button>
            </div>
            {changeMac && (
              <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
                <input value={newMac} onChange={e => setNewMac(e.target.value)} placeholder="New MAC address" style={{flex:1}} />
                <button type="button" className="btn btn-sm btn-primary" onClick={handleChangeMac}>Apply</button>
              </div>
            )}
            {macMsg && <div style={{marginTop:8,fontSize:13,color:'#8b5cf6'}}>{macMsg}</div>}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────── Packages Page ─────────────── */
function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchPackages = useCallback(() => {
    setLoading(true);
    api.get('/packages')
      .then(r => setPackages(r.data.packages || r.data || []))
      .catch(() => showToast('Failed to load packages', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const handleSave = async (formData) => {
    try {
      if (editPkg) {
        await api.put(`/packages/${editPkg.id}`, formData);
        showToast('Package updated');
      } else {
        await api.post('/packages', formData);
        showToast('Package created');
      }
      setShowModal(false);
      setEditPkg(null);
      fetchPackages();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save package', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/packages/${confirmDelete.id}`);
      showToast('Package deleted');
      setConfirmDelete(null);
      fetchPackages();
    } catch {
      showToast('Failed to delete package', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Packages</h2>
        <button className="btn btn-primary" onClick={() => { setEditPkg(null); setShowModal(true); }}>+ Add Package</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>License</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Currency</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-cell">Loading...</td></tr>
              ) : packages.length === 0 ? (
                <tr><td colSpan="7" className="empty-cell">No packages found</td></tr>
              ) : packages.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><br/><small className="text-muted">{p.description || ''}</small></td>
                  <td>{p.license_type}</td>
                  <td>{p.duration_days ? `${p.duration_days} days` : 'Unlimited'}</td>
                  <td>${Number(p.price || 0).toFixed(2)}</td>
                  <td>{p.currency || 'USD'}</td>
                  <td><span className={`badge badge-${p.is_active ? 'success' : 'default'}`}>{p.is_active ? 'Yes' : 'No'}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm btn-ghost" onClick={() => { setEditPkg(p); setShowModal(true); }}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(p)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <PackageFormModal
          pkg={editPkg}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditPkg(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete package "${confirmDelete.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function PackageFormModal({ pkg, onSave, onClose }) {
  const [form, setForm] = useState({
    name: pkg?.name || '',
    description: pkg?.description || '',
    license_type: pkg?.license_type || 'yearly',
    duration_days: pkg?.duration_days || 365,
    price: pkg?.price || '',
    currency: pkg?.currency || 'USD',
    stripe_price_id: pkg?.stripe_price_id || '',
    mollie_price_id: pkg?.mollie_price_id || '',
    is_active: pkg?.is_active !== undefined ? pkg.is_active : true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    onSave({ ...form, price: parseFloat(form.price) || 0, duration_days: parseInt(form.duration_days) || null }).finally(() => setSaving(false));
  };

  return (
    <Modal title={pkg ? 'Edit Package' : 'Add Package'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Package name" required />
          </div>
          <div className="form-group">
            <label>License Type</label>
            <select value={form.license_type} onChange={e => set('license_type', e.target.value)}>
              <option value="yearly">Yearly</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>
          <div className="form-group span-2">
            <label>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Package description" rows="2" />
          </div>
          <div className="form-group">
            <label>Duration (days)</label>
            <input type="number" value={form.duration_days} onChange={e => set('duration_days', e.target.value)} placeholder="365" />
          </div>
          <div className="form-group">
            <label>Price</label>
            <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="29.99" required />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div className="form-group">
            <label>Active</label>
            <select value={form.is_active ? 'true' : 'false'} onChange={e => set('is_active', e.target.value === 'true')}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="form-group">
            <label>Stripe Price ID</label>
            <input value={form.stripe_price_id} onChange={e => set('stripe_price_id', e.target.value)} placeholder="price_xxx" />
          </div>
          <div className="form-group">
            <label>Mollie Price ID</label>
            <input value={form.mollie_price_id} onChange={e => set('mollie_price_id', e.target.value)} placeholder="tr_xxx" />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────── Payments Page ─────────────── */
function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const fetchPayments = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (providerFilter) params.provider = providerFilter;
    api.get('/payments', { params })
      .then(r => setPayments(r.data.payments || r.data || []))
      .catch(() => showToast('Failed to load payments', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter, providerFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return (
    <div>
      <h2 className="page-title">Payments</h2>

      <div className="filter-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
          <option value="">All Providers</option>
          <option value="stripe">Stripe</option>
          <option value="mollie">Mollie</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Device</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Provider</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="empty-cell">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan="6" className="empty-cell">No payments found</td></tr>
              ) : payments.map((p, i) => (
                <tr key={p.id || i}>
                  <td>{new Date(p.created_at || p.date).toLocaleDateString()}</td>
                  <td>{p.device_name || p.mac_address || '-'}</td>
                  <td>{p.package_name || '-'}</td>
                  <td><strong>${Number(p.amount || 0).toFixed(2)}</strong> <small>{p.currency || ''}</small></td>
                  <td><span className="badge badge-default">{p.provider || '-'}</span></td>
                  <td><span className={`badge badge-${p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : p.status === 'failed' ? 'danger' : 'default'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Settings Page ─────────────── */
function SettingsPage() {
  const [settings, setSettings] = useState({
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    mollie_api_key: '',
    trial_days: 3,
    payment_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(r => setSettings(prev => ({ ...prev, ...(r.data.settings || r.data || {}) })))
      .catch(() => showToast('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      showToast('Settings saved');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  if (loading) return <div className="page-loading">Loading settings...</div>;

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <form onSubmit={handleSave}>
        <div className="settings-sections">
          <div className="card settings-card">
            <h3 className="card-title">General</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Trial Days</label>
                <input type="number" value={settings.trial_days} onChange={e => set('trial_days', parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label>Payment Enabled</label>
                <select value={settings.payment_enabled ? 'true' : 'false'} onChange={e => set('payment_enabled', e.target.value === 'true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card settings-card">
            <h3 className="card-title">Stripe</h3>
            <div className="form-grid">
              <div className="form-group span-2">
                <label>Secret Key</label>
                <input type="password" value={settings.stripe_secret_key} onChange={e => set('stripe_secret_key', e.target.value)} placeholder="sk_live_xxx or sk_test_xxx" />
              </div>
              <div className="form-group span-2">
                <label>Webhook Secret</label>
                <input type="password" value={settings.stripe_webhook_secret} onChange={e => set('stripe_webhook_secret', e.target.value)} placeholder="whsec_xxx" />
              </div>
            </div>
          </div>

          <div className="card settings-card">
            <h3 className="card-title">Mollie</h3>
            <div className="form-grid">
              <div className="form-group span-2">
                <label>API Key</label>
                <input type="password" value={settings.mollie_api_key} onChange={e => set('mollie_api_key', e.target.value)} placeholder="live_xxx or test_xxx" />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────── Sidebar ─────────────── */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '\u2302' },
  { key: 'devices', label: 'Devices', icon: '\uD83D\uDCF1' },
  { key: 'packages', label: 'Packages', icon: '\uD83D\uDCE6' },
  { key: 'payments', label: 'Payments', icon: '\uD83D\uDCB3' },
  { key: 'settings', label: 'Settings', icon: '\u2699' },
];

function Sidebar({ activePage, onNavigate, onLogout, collapsed, onToggle }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon-sm">&#9655;</div>
          {!collapsed && <span className="logo-text">Dash Player</span>}
        </div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? '\u276F' : '\u276E'}
        </button>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`nav-item ${activePage === item.key ? 'nav-item-active' : ''}`}
            onClick={() => onNavigate(item.key)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item nav-item-logout" onClick={onLogout} title={collapsed ? 'Logout' : undefined}>
          <span className="nav-icon">&#x2190;</span>
          {!collapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

/* ─────────────── Main App ─────────────── */
export default function AdminApp() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('dash_admin_token'));
  const [page, setPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('dash_admin_token');
    setAuthed(false);
  };

  if (!authed) {
    return (
      <>
        <LoginPage onLogin={() => setAuthed(true)} />
        <ToastContainer />
      </>
    );
  }

  let PageComponent;
  switch (page) {
    case 'devices': PageComponent = DevicesPage; break;
    case 'packages': PageComponent = PackagesPage; break;
    case 'payments': PageComponent = PaymentsPage; break;
    case 'settings': PageComponent = SettingsPage; break;
    default: PageComponent = DashboardPage;
  }

  return (
    <div className="admin-layout">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <main className="admin-main">
        <PageComponent />
      </main>
      <ToastContainer />
    </div>
  );
}
