import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3201,
    proxy: {
      '/api': 'http://localhost:2567',
      '/colyseus': {
        target: 'ws://localhost:2567',
        ws: true,
      },
    },
  },
});
