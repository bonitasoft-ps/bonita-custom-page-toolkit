# Qwik in SPA-only mode (without Qwik City)

Most Qwik documentation assumes you're using **Qwik City** — the meta-framework that adds SSR, file-based routing, and a Node server. For a Bonita custom page we DON'T want any of that:

- Bonita serves static files only (no Node)
- The "page" is a single SPA, not a multi-page site
- Qwik City emits multiple HTML files and an SSR runtime — incompatible

## Configuration

### vite.config.ts

```ts
import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';

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
```

Key points:
- `qwikVite()` is the optimizer plugin — turns `component$()` and `$()` into lazy chunks
- `client.outDir: 'dist'` writes everything under `dist/` (with `q-manifest.json`, `build/q-*.js`)
- `rollupOptions.input: ['./index.html']` makes Vite use our HTML as the entry point — no SSR entry
- `base: './'` produces relative paths so the build works under Bonita's nested URL

(Vite emits a warning that `base` should "begin and end with /" — Qwik handles relative paths regardless. Harmless.)

### index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Directory Bonita Qwik</title>
    <!-- frame-ancestors omitted intentionally — browsers ignore it from <meta> -->
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; base-uri 'self'; form-action 'self'" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/entry.tsx"></script>
  </body>
</html>
```

### src/root.tsx (mandatory file name)

The Qwik optimizer looks for `src/root.tsx` by convention. The file must export a default `component$()`. If you don't have it, build fails with:

```
[vite-plugin-qwik] Qwik input "src/root" not found.
```

This is true even though `src/entry.tsx` is the real entry — `root.tsx` is what the optimizer scans for component graph.

```tsx
// src/root.tsx
import { component$, useStore, useSignal, useVisibleTask$, useStyles$ } from '@builder.io/qwik';

export default component$(() => {
  // ... your app's root component ...
  return <div>Hello Qwik in SPA mode</div>;
});
```

### src/entry.tsx (the actual mount)

```tsx
import { render } from '@builder.io/qwik';
import Root from './root';
import './app.css';

render(document.getElementById('app')!, <Root />);
```

`render(target, jsx)` is Qwik's SPA mount API. Used instead of Qwik City's `renderToStream`.

## Build output

```
dist/
├── index.html
├── q-manifest.json                   ← Qwik's chunk graph (small, harmless)
├── assets/Co9VP8Oj-style.css
└── build/
    ├── q-BHzt0RAr.js                 ← biggest chunk (~50 KB)
    ├── q-naDMFAHy.js                 ← bootstrap chunk
    ├── q-D9hHzKQE.js
    └── ...                            ← lazy chunks for individual handlers
```

`q-manifest.json` is included in the ZIP automatically and Qwik's runtime reads it. Don't strip it.

## Comparison with Qwik City

| | SPA-only (this skill) | Qwik City |
|---|----------------------|-----------|
| Output | One `index.html` + JS chunks | Multiple HTML files (one per route) |
| Entry | `src/entry.tsx` with `render()` | `src/entry.ssr.tsx` with `renderToStream` |
| Routing | Manual `route` signal or hash router | File-based |
| SSR | None | Yes (built-in) |
| Suitable for Bonita custom page? | ✅ Yes | ❌ No |

## Why the Qwik blog/scaffolds rarely show this

The community heavily promotes Qwik City because resumability shines on full sites. SPA-only Qwik is supported but considered niche. For Bonita custom pages it's the only viable option.

If you find yourself fighting Qwik City features you don't want (SSR, file routing, server endpoints), step back: are you sure Qwik is the right framework here? **Svelte 5 or SolidJS produce smaller bundles AND are simpler for the SPA case** ([COMPARISON.md](../../../COMPARISON.md)). Recommend those to the user unless there's a concrete reason for Qwik (heavy page, instant first paint critical, large component count).
