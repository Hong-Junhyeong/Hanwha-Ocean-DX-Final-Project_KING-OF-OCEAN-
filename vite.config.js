import {defineConfig}from 'vite';
// Phase 5 uses the installed ExcelJS dependency in all builds. No offline alias.
export default defineConfig({server:{allowedHosts:['terminal.local']},build:{chunkSizeWarningLimit:1600}});
