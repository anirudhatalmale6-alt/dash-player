import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPkg, setEditPkg] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', max_connections: 1 });

  const fetchPackages = () => {
    setLoading(true);
    api.get('/packages')
      .then(res => setPackages(res.data.packages))
      .catch(() => toast.error('Failed to load packages'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPackages(); }, []);

  const openCreate = () => {
    setEditPkg(null);
    setForm({ name: '', description: '', max_connections: 1 });
    setShowModal(true);
  };

  const openEdit = (pkg) => {
    setEditPkg(pkg);
    setForm({ name: pkg.name, description: pkg.description || '', max_connections: pkg.max_connections });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editPkg) {
        await api.put(`/packages/${editPkg.id}`, form);
        toast.success('Package updated');
      } else {
        await api.post('/packages', form);
        toast.success('Package created');
      }
      setShowModal(false);
      fetchPackages();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this package? Devices using it will be unassigned.')) return;
    try {
      await api.delete(`/packages/${id}`);
      toast.success('Package deleted');
      fetchPackages();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <FiPlus size={18} /> Add Package
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => (
          <div key={pkg.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                {pkg.description && <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(pkg)} className="text-primary-600 hover:text-primary-800 p-1"><FiEdit2 size={16} /></button>
                <button onClick={() => handleDelete(pkg.id)} className="text-red-500 hover:text-red-700 p-1"><FiTrash2 size={16} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Max Connections: <span className="font-medium text-gray-900">{pkg.max_connections}</span></span>
              <span className="text-gray-500">Devices: <span className="font-medium text-primary-600">{pkg.device_count}</span></span>
            </div>
          </div>
        ))}
        {!packages.length && !loading && (
          <div className="col-span-full text-center py-12 text-gray-400">No packages yet. Create one to get started.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-primary-100">
              <h2 className="text-xl font-semibold">{editPkg ? 'Edit Package' : 'Create Package'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Package Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input" rows="2" />
              </div>
              <div>
                <label className="label">Max Connections</label>
                <input type="number" min="1" value={form.max_connections} onChange={e => setForm({...form, max_connections: parseInt(e.target.value)})} className="input" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editPkg ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
