import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { sourcemap: true, chunkSizeWarningLimit: 600 },
});
