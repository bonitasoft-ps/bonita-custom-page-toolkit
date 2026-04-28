# Directory Bonita — React custom page for `appDirectoryBonita`

Clone of the React Task Viewer pre-configured to deploy as the **`home`** page of the **`appDirectoryBonita`** application running on a Bonita instance at **`http://localhost:29106`**.

Final URL once deployed:

```
http://localhost:29106/bonita/apps/appDirectoryBonita/home/?_l=en
```

## What's pre-configured

| Setting | Value | Where |
|---------|-------|-------|
| Vite proxy target | `http://localhost:29106` | `vite.config.ts` |
| Page name (resource id) | `custompage_appDirectoryBonitaHome` | `page.properties` |
| Page display name | `Directory Bonita Home` | `page.properties` |
| Output ZIP | `dist/page-appDirectoryBonitaHome.zip` | `scripts/package-bonita.js` |
| Header text | `Directory Bonita` | `src/pages/Layout.tsx` |

The application token (`appDirectoryBonita`) and the page token within the application (`home`) are not in the source — they're configured in **Bonita Portal → Applications**, see step 2 of deployment.

## Run in dev

```bash
npm install
npm run dev
```

Vite serves on `http://localhost:5173` and proxies `/bonita` → `http://localhost:29106`. Open `http://localhost:5173`. If you're already signed into Bonita Portal at `:29106` in another tab, the session is auto-detected.

## Build the ZIP

Three equivalent ways:

```bash
# Option 1 — npm directly
npm install
npm run build:bonita

# Option 2 — helper script (macOS / Linux / Git Bash)
./build.sh                 # install + build
./build.sh install         # only install
./build.sh build           # only build

# Option 3 — helper script (Windows cmd)
build.bat                  # install + build
build.bat install          # only install
build.bat build            # only build
```

Produces `dist/page-appDirectoryBonitaHome.zip` with the structure:

```
page-appDirectoryBonitaHome.zip
├── page.properties
└── resources/
    ├── index.html
    └── assets/index-{hash}.{js,css}
```

## Deploy

> **Bonita 2025.x users**: the legacy "Bonita Portal" UI was removed. The admin pages live inside two Living Applications: **`superAdminAppBonita`** (platform admin) and **`adminAppEEBonita`** (tenant admin). Full instructions for 2025.x:
>
> → **[`../../DEPLOY_2025.md`](../../DEPLOY_2025.md)**

Quick version (Bonita 2025.x, recommended path — new application + no-menu layout):

1. Login: `http://localhost:29106/bonita/login.jsp` (default `install` / `install`)
2. Upload the page ZIP at the resource list:
   `http://localhost:29106/bonita/apps/superAdminAppBonita/resource-list/` → **+ Add a resource** → `dist/page-appDirectoryBonitaHome.zip`
3. (Optional) Upload a no-menu layout (a separate ZIP with `contentType=layout`) the same way — see DEPLOY_2025.md §3.2 for the minimal layout
4. Create the application:
   `http://localhost:29106/bonita/apps/superAdminAppBonita/application-list/` → **+ Create**
   - Token: `appDirectoryBonita`
   - Layout: `No-menu Layout` (or default)
   - Profile: pick the one your test user has
5. Bind the page:
   `http://localhost:29106/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}` → **Pages** → **+ Add page** → select `Directory Bonita Home` → token `home` → save

Equivalent URLs via the Admin EE app (same operations, `admin-` prefixes):
- Resources: `/bonita/apps/adminAppEEBonita/admin-resource-list/`
- Applications: `/bonita/apps/adminAppEEBonita/admin-application-list/`
- App detail: `/bonita/apps/adminAppEEBonita/admin-application-details/?id={id}`

Then accede a:

```
http://localhost:29106/bonita/apps/appDirectoryBonita/home/?_l=en
```

y listo.

## Updating

Change something in `src/`, run `npm run build:bonita`, upload the new ZIP via **Resources → Add** (Bonita prompts to replace — confirm). Application bindings are preserved; the new build is live immediately. Force-refresh the browser if you see stale HTML.

## Pointing to a different Bonita instance

To target another port or host, edit `vite.config.ts`:

```ts
proxy: {
  '/bonita': {
    target: 'http://your-bonita-host:port',
    changeOrigin: true,
    secure: false,
  },
},
```

The built ZIP itself is host-agnostic (relative paths) — it works on any Bonita instance that imports it.
