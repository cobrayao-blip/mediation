import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
    const usePolling = process.env.VITE_USE_POLLING === 'true';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: true,
        watch: { usePolling },
        proxy: {
          '/api': { target: apiTarget, changeOrigin: true },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
