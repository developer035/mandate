import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/mandate': 'http://localhost:3001',
      '/run': 'http://localhost:3001',
      '/paypal': 'http://localhost:3001',
      '/ledger': 'http://localhost:3001',
      '/demo': 'http://localhost:3001',
      '/health': 'http://localhost:3001'
    }
  }
});
