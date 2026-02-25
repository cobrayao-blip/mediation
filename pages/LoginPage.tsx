/**
 * 登录页：邮箱/手机 + 密码，成功后进入大厅
 */
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const IconLaw = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m14 13-5-5"/><path d="m3 21 3-3"/><path d="m15 13 2-2a1 1 0 0 0-1.42-1.42l-2 2"/>
    <path d="m11 11-4-4a4 4 0 1 0-5.66 5.66l4 4a4 4 0 1 0 5.66-5.66Z"/>
  </svg>
);

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailOrPhone.trim() || !password) {
      setError('请填写邮箱/手机和密码');
      return;
    }
    const result = await login(emailOrPhone, password);
    if (!result.ok) setError(result.error || '登录失败');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-blue-600 text-white p-3 rounded-2xl">
            <IconLaw />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">司法调解实训机</h1>
            <p className="text-sm text-slate-500">请登录后使用</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">邮箱或手机号</label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="admin@mediation.local"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 font-medium" role="alert">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-3 rounded-xl transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-6 text-center">
          首次使用：若后端已创建默认管理员，可使用 admin@mediation.local / admin123
        </p>
      </div>
    </div>
  );
}
