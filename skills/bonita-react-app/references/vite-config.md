# Vite Configuration Template for Bonita React App

## vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  // CRITICAL: relative paths for production (custom page served from any base URL)
  // Dev uses '/' for HMR to work correctly
  base: command === 'build' ? './' : '/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@api': path.resolve(__dirname, 'src/api'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },

  server: {
    // Proxy /bonita to local Bonita instance during development
    // This is the ONLY proxy — it's not needed in production
    proxy: {
      '/bonita': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
}))
```

## tsconfig.json path aliases

Add matching path aliases to `tsconfig.json` for TypeScript resolution:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@pages/*": ["src/pages/*"],
      "@api/*": ["src/api/*"],
      "@hooks/*": ["src/hooks/*"],
      "@stores/*": ["src/stores/*"],
      "@features/*": ["src/features/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

## .env

```env
VITE_BONITA_URL=/bonita
```

Both dev and production use the same value. In dev, Vite's proxy intercepts `/bonita` requests. In production, the app is on the same origin as Bonita so `/bonita` resolves naturally.

## Key decisions explained

### Why `'./'` and not `'/bonita/apps/...'`?

The exact URL path where the custom page is served depends on:
- The application token configured in Bonita Admin
- The page name in the application descriptor

Using `'./'` makes the build portable — it works regardless of the deployment path.

### Why proxy only `/bonita`?

All Bonita APIs are under `/bonita/API/...`, login is `/bonita/loginservice`, etc. A single proxy rule covers everything.

### Why `changeOrigin: true`?

Bonita checks the `Host` header. Without `changeOrigin`, the proxy sends `localhost:5173` as the host, which Bonita may reject.
