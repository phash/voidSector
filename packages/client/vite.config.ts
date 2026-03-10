import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createConnection } from 'net';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

const serverUrl = process.env.VITE_SERVER_URL || 'http://localhost:2567';
const serverWs = serverUrl.replace(/^http/, 'ws');
const serverHost = new URL(serverUrl).hostname;
const serverPort = parseInt(new URL(serverUrl).port || '2567', 10);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'colyseus-ws-proxy',
      configureServer(server) {
        // Proxy Colyseus room WebSocket upgrades to the game server.
        // Room connections use dynamic paths (/<processId>/<roomId>)
        // that Vite's static proxy rules can't match.
        server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
          const url = req.url ?? '';
          // Skip Vite HMR and already-proxied paths
          if (url.startsWith('/@') || url.startsWith('/node_modules') || url.startsWith('/colyseus')) return;
          // Match Colyseus room paths: exactly two path segments
          const segments = url.split('?')[0].split('/').filter(Boolean);
          if (segments.length !== 2) return;

          const upstream = createConnection({ host: serverHost, port: serverPort }, () => {
            // Forward the original HTTP upgrade request
            const reqLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
            const headers = Object.entries(req.headers)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('\r\n');
            upstream.write(reqLine + headers + '\r\n\r\n');
            if (head.length) upstream.write(head);
            socket.pipe(upstream).pipe(socket);
          });
          upstream.on('error', (err) => {
            console.error('[colyseus-ws-proxy]', err.message);
            socket.end();
          });
          socket.on('error', () => upstream.end());
        });
      },
    },
  ],
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
