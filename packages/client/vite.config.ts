import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverUrl = process.env.VITE_SERVER_URL || 'http://localhost:2567';
const serverWs = serverUrl.replace(/^http/, 'ws');

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: mode === 'development'
    ? {
        // In dev mode, Colyseus room WS connections use dynamic paths
        // (/<processId>/<roomId>) that the Vite proxy can't catch.
        // Point WS directly at the game server.
        'import.meta.env.VITE_WS_URL': JSON.stringify(serverWs),
      }
    : {},
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
}));
