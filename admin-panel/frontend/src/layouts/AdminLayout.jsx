import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FiHome, FiMonitor, FiPackage, FiList, FiSettings, FiLogOut, FiMenu, FiX } from 'react-icons/fi';

const navItems = [
  { path: '/', label: 'Dashboard', icon: FiHome },
  { path: '/devices', label: 'Devices', icon: FiMonitor },
  { path: '/packages', label: 'Packages', icon: FiPackage },
  { path: '/playlists', label: 'Playlists', icon: FiList },
  { path: '/settings', label: 'Settings', icon: FiSettings },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-dash-light">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary-800 to-primary-900 text-white transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-primary-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-primary-700 font-bold text-lg">D</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Dash Player</h1>
              <p className="text-primary-300 text-xs">Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-primary-300 hover:text-white">
            <FiX size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-primary-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{admin?.username}</p>
              <p className="text-primary-300 text-xs capitalize">{admin?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-primary-300 hover:text-white p-2 rounded-lg hover:bg-white/10">
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white shadow-sm border-b border-primary-100 px-6 py-4 flex items-center justify-between lg:justify-end">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-primary-700">
            <FiMenu size={24} />
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Welcome, <span className="font-medium text-primary-700">{admin?.username}</span></span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
