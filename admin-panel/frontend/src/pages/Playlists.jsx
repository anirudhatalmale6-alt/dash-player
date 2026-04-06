import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiWifi } from 'react-icons/fi';

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPl, setEditPl] = useState(null);
  const [testing, setTesting] = useState(null);
  const [form, setForm] = useState({ name: '', xtream_url: '', xtream_username: '', xtream_password: '' });

  const fetchPlaylists = () => {
    setLoading(true);
    api.get('/playlists')
      .then(res => setPlaylists(res.data.playlists))
      .catch(() => toast.error('Failed to load playlists'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlaylists(); }, []);

  const openCreate = () => {
    setEditPl(null);
    setForm({ name: '', xtream_url: '', xtream_username: '', xtream_password: '' });
    setShowModal(true);
  };

  const openEdit = (pl) => {
    setEditPl(pl);
    setForm({ name: pl.name, xtream_url: pl.xtream_url, xtream_username: pl.xtream_username, xtream_password: pl.xtream_password });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editPl) {
        await api.put(`/playlists/${editPl.id}`, form);
        toast.success('Playlist updated');
      } else {
        await api.post('/playlists', form);
        toast.success('Playlist created');
      }
      setShowModal(false);
      fetchPlaylists();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this playlist?')) return;
    try {
      await api.delete(`/playlists/${id}`);
      toast.success('Playlist deleted');
      fetchPlaylists();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const testConnection = async (id) => {
    setTesting(id);
    try {
      const res = await api.post(`/playlists/${id}/test`);
      toast.success(`Connected! Server: ${res.data.server_info?.server_info?.url || 'OK'}`);
    } catch (err) {
      toast.error('Connection failed');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Playlists</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus size={18} /> Add Playlist
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {playlists.map(pl => (
          <div key={pl.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{pl.name}</h3>
                <p className="text-sm text-gray-500 mt-1 font-mono break-all">{pl.xtream_url}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => testConnection(pl.id)} disabled={testing === pl.id} className="text-green-600 hover:text-green-800 p-1" title="Test connection">
                  <FiWifi size={16} className={testing === pl.id ? 'animate-pulse' : ''} />
                </button>
                <button onClick={() => openEdit(pl)} className="text-primary-600 hover:text-primary-800 p-1"><FiEdit2 size={16} /></button>
                <button onClick={() => handleDelete(pl.id)} className="text-red-500 hover:text-red-700 p-1"><FiTrash2 size={16} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">User: <span className="font-medium">{pl.xtream_username}</span></span>
              <span className="text-gray-500">Devices: <span className="font-medium text-primary-600">{pl.device_count}</span></span>
            </div>
          </div>
        ))}
        {!playlists.length && !loading && (
          <div className="col-span-full text-center py-12 text-gray-400">No playlists yet. Add your Xtream Codes server to get started.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-primary-100">
              <h2 className="text-xl font-semibold">{editPl ? 'Edit Playlist' : 'Add Playlist'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Playlist Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" placeholder="Main Server" required />
              </div>
              <div>
                <label className="label">Xtream Codes URL</label>
                <input value={form.xtream_url} onChange={e => setForm({...form, xtream_url: e.target.value})} className="input" placeholder="http://server.com:port" required />
              </div>
              <div>
                <label className="label">Username</label>
                <input value={form.xtream_username} onChange={e => setForm({...form, xtream_username: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input value={form.xtream_password} onChange={e => setForm({...form, xtream_password: e.target.value})} className="input" required />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editPl ? 'Update' : 'Add Playlist'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
