
import { defineConfig } from 'vite';

const repo = 'Hanwha-Ocean-DX-Final-Project_KING-OF-OCEAN-';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ||
    (process.env.GITHUB_ACTIONS === 'true' ? `/${repo}/` : '/'),
  server: {
    allowedHosts: ['terminal.local'],
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
