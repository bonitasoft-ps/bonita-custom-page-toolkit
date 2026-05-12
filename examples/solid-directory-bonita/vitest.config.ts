import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx,vue,svelte,jsx}'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test-setup.ts',
        'src/mocks/**',
        'src/main.{ts,tsx}',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        'src/api/**':         { lines: 80, functions: 80, branches: 75 },
        'src/composables/**': { lines: 80, functions: 80, branches: 75 },
        'src/hooks/**':       { lines: 80, functions: 80, branches: 75 },
        'src/stores/**':      { lines: 80, functions: 80, branches: 75 },
      },
    },
  },
});
