/**
 * 鉴权 Context：Token、当前用户、登录/登出，请求头自动带 Token
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TOKEN_KEY = 'mediation_token';
const USER_KEY = 'mediation_user';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (emailOrPhone: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  getToken: () => string | null;
  setAuthFromStorage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const persist = useCallback((t: string | null, u: AuthUser | null) => {
    setToken(t);
    setUser(u);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(async (emailOrPhone: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: emailOrPhone.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || '登录失败' };
      }
      persist(data.token, data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: '网络错误' };
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const logout = useCallback(() => {
    persist(null, null);
  }, [persist]);

  const getToken = useCallback(() => token, [token]);

  const setAuthFromStorage = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    setToken(t);
    if (t) {
      try {
        const u = localStorage.getItem(USER_KEY);
        if (u) setUser(JSON.parse(u));
      } catch {}
    } else {
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = {
    token,
    user,
    loading,
    login,
    logout,
    getToken,
    setAuthFromStorage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** 带 Token 的 fetch，401 时返回 null 并可由调用方处理登出 */
export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  return res;
}
