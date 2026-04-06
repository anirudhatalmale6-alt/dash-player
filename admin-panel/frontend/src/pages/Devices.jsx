import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiRefreshCw, FiCopy, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [packages, setPackages] = useState([]);
  const [playlists, setPlaylists] = useState([]);

  const [form, setForm] = useState({
    mac_address: '', device_name: '', device_type: 'android_tv',
    package_id: '', expiry_type: '1year', expiry_date: '', notes: '', playlist_ids: []
  });

  const fetchDevices = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 25 });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('device_type', typeFilter);

    api.get(`/devices?${params}`)
      .then(res => { setDevices(res.data.devices); setPagination(res.data.pagination); })
      .catch(() => toast.error('Failed to load devices'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDevices(); }, [page, statusFilter, typeFilter]);
  useEffect(() => {
    api.get('/packages').then(r => setPackages(r.data.packages)).catch(() => {});
    api.get('/playlists').then(r => setPlaylists(r.data.playlists)).catch(() => {});
  }, []);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchDevices(); };

  const openCreate = () => {
    setEditDevice(null);
    setForm({ mac_address: '', device_name: '', device_type: 'android_tv', package_id: '', expiry_type: '1year', expiry_date: '', notes: '', playlist_ids: [] });
    setShowModal(true);
  };

  const openEdit = (device) => {
    setEditDevice(device);
    setForm({
      mac_address: device.mac_address, device_name: device.device_name || '',
      device_type: device.device_type, package_id: device.package_id || '',
      expiry_type: device.is_unlimited ? 'unlimited' : 'custom',
      expiry_date: device.expiry_date ? device.expiry_date.slice(0, 16) : '',
      notes: device.notes || '', playlist_ids: []
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editDevice) {
        await api.put(`/devices/${editDevice.id}`, form);
        toast.success('Device updated');
      } else {
        const res = await api.post('/devices', form);
        toast.success(`Device created! Key: ${res.data.device_key}`);
      }
      setShowModal(false);
      fetchDevices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this device?')) return;
    try {
      await api.delete(`/devices/${id}`);
      toast.success('Device deleted');
      fetchDevices();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('Device key copied');
  };

  const getStatusBadge = (device) => {
    if (!device.is_active) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Disabled</span>;
    if (!device.is_unlimited && device.expiry_date && new Date(device.expiry_date) < new Date()) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">Expired</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">Active</span>;
  };

  const typeLabels = { android_tv: 'Android TV', tizen: 'Tizen', webos: 'webOS', windows: 'Windows', mag: 'MAG' };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus size={18} /> Add Device
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search MAC, key, or name..." className="input pl-10" />
            </div>
            <button type="submit" className="btn-secondary">Search</button>
          </form>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
            <option value="expired">Expired</option>
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All Types</option>
            <option value="android_tv">Android TV</option>
            <option value="tizen">Tizen</option>
            <option value="webos">webOS</option>
            <option value="windows">Windows</option>
            <option value="mag">MAG</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary-100">
              <th className="text-left py-3 px-4 font-medium text-gray-500">MAC Address</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Package</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Expiry</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Key</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id} className="border-b border-primary-50 hover:bg-primary-50/50">
                <td className="py-3 px-4 font-mono text-xs">{device.mac_address}</td>
                <td className="py-3 px-4">{device.device_name || '-'}</td>
                <td className="py-3 px-4">{typeLabels[device.device_type]}</td>
                <td className="py-3 px-4">{device.package_name || '-'}</td>
                <td className="py-3 px-4">{getStatusBadge(device)}</td>
                <td className="py-3 px-4 text-xs">
                  {device.is_unlimited ? <span className="text-primary-600 font-medium">Unlimited</span> : (device.expiry_date ? new Date(device.expiry_date).toLocaleDateString() : '-')}
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => copyKey(device.device_key)} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs">
                    <FiCopy size={12} /> {device.device_key.slice(0, 8)}...
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(device)} className="text-primary-600 hover:text-primary-800 p-1"><FiEdit2 size={16} /></button>
                    <button onClick={() => handleDelete(device.id)} className="text-red-500 hover:text-red-700 p-1"><FiTrash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!devices.length && (
              <tr><td colSpan="8" className="text-center py-8 text-gray-400">No devices found</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary-100">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-2 disabled:opacity-50">
                <FiChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium px-2">{page} / {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn-secondary p-2 disabled:opacity-50">
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-primary-100">
              <h2 className="text-xl font-semibold">{editDevice ? 'Edit Device' : 'Add New Device'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">MAC Address</label>
                <input value={form.mac_address} onChange={e => setForm({...form, mac_address: e.target.value})} className="input" placeholder="AA:BB:CC:DD:EE:FF" required />
              </div>
              <div>
                <label className="label">Device Name</label>
                <input value={form.device_name} onChange={e => setForm({...form, device_name: e.target.value})} className="input" placeholder="Living Room TV" />
              </div>
              <div>
                <label className="label">Device Type</label>
                <select value={form.device_type} onChange={e => setForm({...form, device_type: e.target.value})} className="input">
                  <option value="android_tv">Android TV</option>
                  <option value="tizen">Samsung (Tizen)</option>
                  <option value="webos">LG (webOS)</option>
                  <option value="windows">Windows</option>
                  <option value="mag">MAG</option>
                </select>
              </div>
              <div>
                <label className="label">Package</label>
                <select value={form.package_id} onChange={e => setForm({...form, package_id: e.target.value})} className="input">
                  <option value="">No Package</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Expiry</label>
                <select value={form.expiry_type} onChange={e => setForm({...form, expiry_type: e.target.value})} className="input">
                  <option value="1year">1 Year</option>
                  <option value="unlimited">Unlimited</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>
              {form.expiry_type === 'custom' && (
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="datetime-local" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} className="input" />
                </div>
              )}
              <div>
                <label className="label">Playlists</label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-primary-200 rounded-lg p-3">
                  {playlists.map(pl => (
                    <label key={pl.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.playlist_ids.includes(pl.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...form.playlist_ids, pl.id]
                            : form.playlist_ids.filter(id => id !== pl.id);
                          setForm({...form, playlist_ids: ids});
                        }}
                        className="rounded text-primary-600"
                      />
                      {pl.name}
                    </label>
                  ))}
                  {!playlists.length && <p className="text-gray-400 text-xs">No playlists. Add one first.</p>}
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input" rows="2" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editDevice ? 'Update' : 'Create Device'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
