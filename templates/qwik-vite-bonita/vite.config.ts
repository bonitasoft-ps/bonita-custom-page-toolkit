import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';

// Qwik in SPA-only mode (no Qwik City, no SSR).
// We use the core Qwik optimizer + a single client entry that mounts the app
// on `document`. Resumability still works on the client side.
export default defineConfig({
  base: './',
  plugins: [
    qwikVite({
      client: {
        outDir: 'dist',
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: ['./index.html'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/bonita': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
