import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/jest-shim.ts', './src/test/setup.ts'],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      '@void-sector/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
