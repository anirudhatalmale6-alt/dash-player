import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiMonitor, FiActivity, FiPackage, FiList, FiAlertTriangle, FiClock } from 'react-icons/fi';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-primary-600">Loading...</div></div>;
  if (!data) return <div className="text-center text-gray-500">Failed to load dashboard</div>;

  const statCards = [
    { label: 'Total Devices', value: data.stats.total_devices, icon: FiMonitor, color: 'bg-primary-100 text-primary-700' },
    { label: 'Active Devices', value: data.stats.active_devices, icon: FiActivity, color: 'bg-green-100 text-green-700' },
    { label: 'Online Now', value: data.stats.online_devices, icon: FiActivity, color: 'bg-blue-100 text-blue-700' },
    { label: 'Expired', value: data.stats.expired_devices, icon: FiAlertTriangle, color: 'bg-red-100 text-red-700' },
    { label: 'Packages', value: data.stats.total_packages, icon: FiPackage, color: 'bg-purple-100 text-purple-700' },
    { label: 'Playlists', value: data.stats.total_playlists, icon: FiList, color: 'bg-indigo-100 text-indigo-700' },
  ];

  const typeLabels = { android_tv: 'Android TV', tizen: 'Tizen', webos: 'webOS', windows: 'Windows', mag: 'MAG' };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="card flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
              <card.icon size={24} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Devices by Type */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Devices by Platform</h2>
          <div className="space-y-3">
            {data.devices_by_type.map(item => (
              <div key={item.device_type} className="flex items-center justify-between">
                <span className="text-gray-700">{typeLabels[item.device_type] || item.device_type}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-primary-100 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (item.count / data.stats.total_devices) * 100)}%` }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8 text-right">{item.count}</span>
                </div>
              </div>
            ))}
            {!data.devices_by_type.length && <p className="text-gray-400 text-sm">No devices yet</p>}
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Expiring Soon (7 days)</h2>
          <div className="space-y-3">
            {data.expiring_soon.map(device => (
              <Link key={device.id} to={`/devices/${device.id}`} className="flex items-center justify-between hover:bg-primary-50 p-2 rounded-lg -mx-2">
                <div>
                  <p className="font-medium text-gray-900">{device.device_name || device.mac_address}</p>
                  <p className="text-sm text-gray-500">{device.mac_address}</p>
                </div>
                <div className="flex items-center gap-2 text-orange-600">
                  <FiClock size={14} />
                  <span className="text-sm font-medium">
                    {new Date(device.expiry_date).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
            {!data.expiring_soon.length && <p className="text-gray-400 text-sm">No devices expiring soon</p>}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.recent_activity.map(log => (
              <div key={log.id} className="flex items-start gap-3 text-sm border-b border-primary-50 pb-3">
                <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-gray-700">
                    <span className="font-medium">{log.admin_name || 'System'}</span>
                    {' - '}
                    <span>{log.action.replace(/_/g, ' ')}</span>
                    {log.device_name && <span className="text-primary-600"> ({log.device_name})</span>}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {!data.recent_activity.length && <p className="text-gray-400 text-sm">No activity yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
