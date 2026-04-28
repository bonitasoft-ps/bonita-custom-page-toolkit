# Angular Configuration Template — Bonita custom page

## angular.json — key edits

Open `angular.json` and modify the build options of your project.

### Inside `projects.{app-name}.architect.build.options`

```json
{
  "outputPath": "dist/{app-name}",
  "baseHref": "./",
  "index": "src/index.html",
  "browser": "src/main.ts",
  "polyfills": ["zone.js"],
  "tsConfig": "tsconfig.app.json",
  "assets": [
    { "glob": "**/*", "input": "public" }
  ],
  "styles": ["src/styles.css"],
  "scripts": []
}
```

The two critical ones:

- `outputPath`: keep at default (`dist/{app-name}`). Angular will create `dist/{app-name}/browser/` for the static files.
- `baseHref`: `./` — relative paths in `index.html`. Without this, `<script src="/main-XXX.js">` resolves to `/main-XXX.js` (server root), not the page directory.

### Inside `projects.{app-name}.architect.serve.options`

```json
{
  "proxyConfig": "proxy.conf.json"
}
```

This wires `ng serve` to proxy `/bonita` → Bonita Tomcat. The proxy file itself is below.

### Disable SSR

In a fresh project with `--ssr=false`, the build target is already `browser-esbuild` and there's no `server` configuration. If you scaffolded with SSR enabled by mistake, remove from `angular.json`:

- The entire `server` configuration under `architect.build`
- The `architect.serve-ssr` block
- The `architect.prerender` block

Then delete `src/main.server.ts` and `src/server.ts` if they exist.

## proxy.conf.json (project root)

```json
{
  "/bonita": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug",
    "cookieDomainRewrite": {
      "*": "localhost"
    }
  }
}
```

`logLevel: "debug"` is helpful while debugging the proxy. Set to `"warn"` once stable.

`cookieDomainRewrite: { "*": "localhost" }` is critical: Bonita responds with `Set-Cookie: ...; Domain=localhost`, but the dev server runs on a different port. The browser drops the cookie unless the domain matches. This option rewrites all `Set-Cookie` `Domain=` attributes to `localhost`.

## tsconfig.app.json (no changes needed)

The default Angular tsconfig works. Optionally add path aliases:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": [],
    "baseUrl": "./src",
    "paths": {
      "@app/*": ["app/*"],
      "@api/*": ["app/api/*"],
      "@stores/*": ["app/stores/*"]
    }
  }
}
```

Use sparingly — Angular conventions already provide good organization without aliases.

## src/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My Bonita App</title>
    <base href="./" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self';
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: blob:; connect-src 'self';
      frame-src 'self' blob:; frame-ancestors 'none';
      base-uri 'self'; form-action 'self'" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

`<base href="./" />` is added by Angular when you set `baseHref` in `angular.json`. If it isn't there, add it manually — without it, hash routing still works but module imports may break.

`'unsafe-inline'` for `style-src` is required by ng-zorro and Angular Material because they inject styles dynamically.

## .editorconfig & lint

Default Angular lint/editorconfig are fine. No Bonita-specific changes needed.

## What you do NOT need

- **No `<base href>` override at runtime** — `angular.json` handles it.
- **No HTML5 history fallback** — we're using `HashLocationStrategy`, so unknown URLs always serve `index.html` automatically (the hash is client-side).
- **No SSR / prerendering** — Bonita serves static files only.
- **No service worker** — scope conflicts with the deep nested URL prevent it from working anyway.
