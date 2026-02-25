/**
 * 简单 Toast：替代 alert，几秒后自动消失
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastContextValue = {
  message: string | null;
  type: 'info' | 'error' | 'success';
  show: (msg: string, type?: 'info' | 'error' | 'success') => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<'info' | 'error' | 'success'>('info');

  const show = useCallback((msg: string, t: 'info' | 'error' | 'success' = 'info') => {
    setMessage(msg);
    setType(t);
    setTimeout(() => setMessage(null), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ message, type, show }}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${
            type === 'error' ? 'bg-rose-600' : type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'
          }`}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { message: null, type: 'info' as const, show: () => {} };
  return ctx;
}
