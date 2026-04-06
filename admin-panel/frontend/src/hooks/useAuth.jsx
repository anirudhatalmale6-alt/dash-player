import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    const saved = localStorage.getItem('dash_admin');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dash_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setAdmin(res.data.admin);
          localStorage.setItem('dash_admin', JSON.stringify(res.data.admin));
        })
        .catch(() => {
          localStorage.removeItem('dash_token');
          localStorage.removeItem('dash_admin');
          setAdmin(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('dash_token', res.data.token);
    localStorage.setItem('dash_admin', JSON.stringify(res.data.admin));
    setAdmin(res.data.admin);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('dash_token');
    localStorage.removeItem('dash_admin');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
