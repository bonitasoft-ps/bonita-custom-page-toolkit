# Architecture — How a Bonita custom page is served

## The big picture

```
┌─────────────────────────────────────────────────────────────┐
│                    Bonita Tomcat (8080)                     │
│                                                             │
│  ┌────────────────────┐     ┌──────────────────────────┐    │
│  │  Bonita Portal     │     │  REST API                │    │
│  │  /bonita/portal    │     │  /bonita/API/...         │    │
│  │                    │     │  /bonita/loginservice    │    │
│  │  ┌──────────────┐  │     │  /bonita/logoutservice   │    │
│  │  │   <iframe>   │  │     └──────────────────────────┘    │
│  │  │              │  │                                     │
│  │  │  Custom Page │──┼─────► same-origin AJAX              │
│  │  │  (your SPA)  │  │       (no CORS, cookies sent)       │
│  │  └──────────────┘  │                                     │
│  └────────────────────┘                                     │
│         ▲                                                   │
│         │ serves index.html + JS/CSS from ZIP               │
│         │                                                   │
│  ┌──────┴───────────────────────────────────────────────┐   │
│  │  Resources storage (uploaded ZIPs)                   │   │
│  │  /bonita/portal/resource/page/{profile}/{name}/...   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Request lifecycle

### Initial page load

```
1. User navigates to: /bonita/apps/{appToken}/{pageToken}/
2. Bonita Portal renders an HTML shell with an <iframe>
3. iframe src = /bonita/portal/resource/page/{profile}/{pageName}/content/
4. Tomcat serves resources/index.html from the uploaded ZIP
5. index.html loads ./assets/index-{hash}.js (relative path resolves under content/)
6. SPA mounts inside the iframe
```

### API call from the SPA

```
1. SPA calls: fetch('/bonita/API/system/session/unusedId', { credentials: 'include' })
2. Browser appends JSESSIONID + X-Bonita-API-Token cookies (same origin)
3. Tomcat routes to the Bonita REST handler
4. Response returns JSON
5. No CORS preflight, no proxy, no cross-origin headers needed
```

### The dev environment trick

```
                          npm run dev
              ┌──────────────────────────────────┐
              │                                  │
   Browser ──►│  Vite/ng dev server (5173/4200)  │──── HMR ──► reloaded modules
              │                                  │
              │  proxy: /bonita → :8080          │
              └──────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────────┐
              │  Bonita Tomcat (localhost:8080)  │
              └──────────────────────────────────┘
```

The SAME relative URL `/bonita/API/...` is used in dev and prod — Vite/Angular proxies it to `:8080` only in dev. This means **zero code change** between environments.

## Why this architecture

| Concern | Choice | Why |
|---------|--------|-----|
| Frontend hosting | Bonita Tomcat | One server to deploy. No nginx/Apache. |
| Cross-origin | None — same origin | No CORS configuration. Cookies just work. |
| Session | Bonita session cookies | The user is already logged into Bonita Portal. |
| Routing | Hash (`#/`) | Tomcat doesn't rewrite SPA paths. |
| Build output | Static files | Bonita serves them as resources. No SSR. |
| Deployment | ZIP upload | Single artifact, atomic update, browser cache invalidates via filename hashes. |

## Iframe constraints to keep in mind

- **`window.parent` access** is allowed because iframe and parent share origin (both on Bonita's host). You CAN read the parent URL hash to support deep links.
- **Bookmarkable URLs** require syncing your hash to the parent's hash (the parent URL is what the browser bookmarks). See the React `iframe-sync-template.md` for the pattern — equivalent hooks/services apply to Vue and Angular.
- **`window.top.document.title`** can be set from the iframe to update the parent's title.
- **Full-page redirects** (`window.location = ...`) inside the iframe only navigate the iframe, not the parent. Avoid them.
- **Modals**: prefer in-iframe modal libraries (the parent doesn't render them).

## What can NOT be done as a custom page

- **Service workers** with offline caching — service worker scope is constrained by the path; the deep nesting under `/bonita/portal/resource/page/...` means the SW can only control that subpath, which is rarely useful.
- **Server-side rendering (SSR)** — the page is just static files. If you need SSR, build a real backend and embed it via reverse proxy (a different deployment model not covered here).
- **WebSockets** — Bonita itself doesn't expose a WebSocket API to custom pages. You can connect to other origins but that requires CSP and CORS configuration.
