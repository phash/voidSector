import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverUrl = process.env.VITE_SERVER_URL || 'http://localhost:2567';
const serverWs = serverUrl.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3201,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': serverUrl,
      '/matchmake': serverUrl,
      '/colyseus': {
        target: serverWs,
        ws: true,
      },
    },
  },
});
