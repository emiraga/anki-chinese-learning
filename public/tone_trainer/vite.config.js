import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5174,
    open: true
  },
  // Copy public assets (audio files, fftjs, etc.) to dist
  publicDir: false, // We'll handle this manually since we're already in a public folder
});
