/**
 * 鉴权门控：无 Token 显示登录页；有 Token 时校验 /api/users/me，通过后显示主应用或管理后台
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, fetchWithAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import App from './App';
import AdminPage from './pages/AdminPage';
import UserCenterPage from './pages/UserCenterPage';

export default function AppGate() {
  const { token, user, logout } = useAuth();
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidated(true);
      return;
    }
    let cancelled = false;
    fetchWithAuth('/api/users/me')
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) logout();
        setValidated(true);
      })
      .catch(() => {
        if (!cancelled) setValidated(true);
      });
    return () => { cancelled = true; };
  }, [token, logout]);

  if (!token) {
    return <LoginPage />;
  }
  if (!validated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-medium">加载中...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/user" element={<UserCenterPage />} />
        <Route path="/admin" element={user?.role === 'admin' ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
