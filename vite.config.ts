import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('node_modules/phaser/')) {
            return 'vendor-phaser';
          }
          if (normalized.includes('/src/data/')) {
            return 'game-data';
          }
          return undefined;
        },
      },
    },
  },
});
