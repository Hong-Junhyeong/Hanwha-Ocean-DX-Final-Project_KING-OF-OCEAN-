
import { defineConfig } from 'vite';

// GitHub Pages uses the repository name as part of the URL.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    allowedHosts: ['terminal.local'],
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
