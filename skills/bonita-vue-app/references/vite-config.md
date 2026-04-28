# Vite Configuration Template — Vue 3 + Bonita

## vite.config.ts

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // CRITICAL: relative paths so the build runs from any base URL
  base: './',

  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/bonita': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
});
```

## tsconfig.json — path alias

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

## .env

```env
VITE_BONITA_URL=/bonita
```

## Why each setting

### `base: './'`

The custom page is served from `/bonita/portal/resource/page/.../content/`, a deep path. Absolute paths (`/assets/...`) would resolve to `/assets/...` — outside the page directory — and 404. Relative paths (`./assets/...`) resolve correctly under any base URL.

Unlike React's template (`command === 'build' ? './' : '/'`), Vue's HMR works fine with `'./'` in dev too — keeping a single value is simpler.

### `cookieDomainRewrite: 'localhost'`

When the dev proxy forwards a request to `:8080`, Bonita responds with `Set-Cookie: ...; Domain=localhost`. The browser uses the proxy's domain (`localhost:5173`), so the cookie attribute must be rewritten to match. Without this, login appears to work but the session cookie is dropped.

### `changeOrigin: true`

Bonita's Tomcat checks the `Host` header. Without this, the proxy sends `Host: localhost:5173` which Tomcat may reject as an unrecognized virtual host.

### `port: 5173`

Vite's default. If something else is on 5173, change to 5174 / 3000 / etc. — make sure to update any hard-coded references in your team docs.

## Optional — env-mode-specific config

If you genuinely need different configs per mode (rare):

```ts
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : './',
  // ...
}));
```

But normally `'./'` for both is the simplest path.

## Optional — proxy multiple Bonita instances

For testing against staging or a remote dev box:

```ts
server: {
  proxy: {
    '/bonita': {
      target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
      changeOrigin: true,
      cookieDomainRewrite: 'localhost',
    },
  },
},
```

Then start with `VITE_PROXY_TARGET=https://staging.example.com npm run dev`.
