import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from '../api.js';
import { Layout } from '../Layout.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Editor } from './Editor.jsx';
import { Login } from './Login.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AdminArea() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.me().then(() => setStatus('in'), () => setStatus('out'));
  }, []);

  const login = useCallback(async (username, password) => {
    await api.login(username, password);
    setStatus('in');
  }, []);
  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setStatus('out');
  }, []);

  if (status === 'loading') return <Layout><p>Loading…</p></Layout>;

  return (
    <AuthContext.Provider value={{ status, login, logout }}>
      <Layout>
        <Routes>
          <Route path="login" element={status === 'in' ? <Navigate to="/admin" replace /> : <Login />} />
          <Route path="*" element={status === 'out' ? <Navigate to="/admin/login" replace /> : <AdminRoutes />} />
        </Routes>
      </Layout>
    </AuthContext.Provider>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="pages/new" element={<Editor mode="new" />} />
      <Route path="pages/edit" element={<Editor mode="edit" />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
