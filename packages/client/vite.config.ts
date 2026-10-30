import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Təkcə Phaser ~1,5 MB-dır (~420 KB gzip); büdcə 5 MB gzip-dir (arxitektura, bölmə 11).
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // Oyunu telefonda açmaq üçün lokal şəbəkədə dinləyir.
    host: true,
    port: 5173,
  },
});
