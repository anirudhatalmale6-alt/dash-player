import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Packages from './pages/Packages';
import Playlists from './pages/Playlists';
import Settings from './pages/Settings';
import './styles/index.css';

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-primary-600 text-lg">Loading...</div></div>;
  if (!admin) return <Navigate to="/login" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="devices" element={<Devices />} />
            <Route path="packages" element={<Packages />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', background: '#333', color: '#fff' } }} />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
