import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  root: import.meta.dirname,
  plugins: [react()],
  base: mode === 'pages' ? '/rafnexa/' : '/',
  define: {
    'import.meta.env.VITE_LOCAL_DEMO': JSON.stringify(mode === 'pages' ? 'true' : 'false'),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { sourcemap: true, chunkSizeWarningLimit: 600 },
}));
