# Deployment — uploading a custom page ZIP to Bonita

This guide is **framework-agnostic**. Whether your ZIP came from React, Vue or Angular, the deployment process is the same.

## Prerequisites

- A running Bonita instance (Studio, Tomcat bundle, Docker, or Subscription). Default URL: `http://localhost:8080`
- Admin credentials (Studio default: `install` / `install`)
- A built ZIP file: `dist/page-{name}.zip` produced by `npm run build:bonita` in your project

## What's in the ZIP (sanity check)

Before uploading, you can verify the ZIP has the right structure:

```bash
# Windows PowerShell
Expand-Archive -Path .\dist\page-{name}.zip -DestinationPath .\dist\verify -Force
Get-ChildItem -Recurse .\dist\verify

# macOS / Linux
unzip -l dist/page-{name}.zip
```

Expected layout:
```
page.properties                      ← MUST be at ZIP root
resources/index.html                 ← MUST be under resources/
resources/assets/index-{hash}.js
resources/assets/index-{hash}.css
```

If `page.properties` is missing or under `resources/`, or if there's no `resources/` directory, **the build is broken** — fix the packaging script first.

---

## Path A — Deploy via Bonita Portal (recommended)

### 1. Open Bonita Portal

```
http://localhost:8080/bonita/
```

Log in as Admin (`install` / `install` for the Studio bundle).

### 2. Upload the page resource

1. Open the admin menu and go to **Resources** (in the Subscription Edition / Tomcat bundle) or **Configuration → Resources** depending on your version.
2. Click **Add** (top-right).
3. Select your `dist/page-{name}.zip`.
4. Bonita reads `page.properties`, registers the resource, and shows it in the list with its `displayName`.

If the ZIP is malformed you'll see one of these errors:
- `Invalid page.properties` — fix the `name` / `contentType` fields
- `Page name must start with custompage_` — rename in `page.properties`
- `Cannot read content` — the ZIP layout is wrong

### 3. Add the page to a Living Application

A custom page is only reachable if it belongs to an Application.

1. Open **Applications** in the admin menu.
2. Either:
   - Click an existing application, or
   - Click **+** to create one:
     - **Token**: e.g., `tasks` (used in the URL)
     - **Display name**: e.g., "Task Manager"
     - **Profile**: pick which Bonita profile sees the app (User / Administrator / Process manager / a custom profile)
3. Open the application → **Pages** tab → **Add**.
4. Pick your page from the dropdown (it appears using the `displayName` from `page.properties`).
5. Set a **Token** for this page within the app: e.g., `viewer`. This becomes the URL path.
6. Optionally mark it as **Home page** (so the app's root URL renders this page).

### 4. Access the page

```
http://localhost:8080/bonita/apps/{appToken}/{pageToken}/
```

Examples (matching the included examples):
- `http://localhost:8080/bonita/apps/tasks/viewer/`
- If the page is the home page: `http://localhost:8080/bonita/apps/tasks/`

### 5. Test it

- Login should work (or auto-detect the existing Portal session)
- The task list should populate from `GET /bonita/API/bpm/humanTask`
- Logout returns you to the Portal

If the page is blank, jump to **Troubleshooting** below.

---

## Path B — Deploy via Bonita Studio (fastest for development)

The Bonita Studio (the desktop IDE) has its own embedded Tomcat. It exposes the same Portal as the Subscription bundle but with a tighter dev loop.

1. Open Bonita Studio.
2. Top menu: **Development → Manage REST API extensions and Pages** (the exact label varies between versions: `Manage API extensions`, `Pages and Forms`, etc.).
3. Click **Import** → select your ZIP.
4. The Studio imports it into its embedded Tomcat.
5. The Studio also lets you assign the page to an application from the same dialog.
6. Access at `http://localhost:8080/bonita/apps/{appToken}/`.

The Studio's embedded Tomcat lives at `http://localhost:8080/bonita/` by default, same as the standalone bundle.

---

## Path C — Deploy via REST API (for CI/CD)

For automated pipelines, drive the upload from a script.

```bash
# 1. Login to get session cookies
curl -c cookies.txt -X POST 'http://localhost:8080/bonita/loginservice' \
  -d 'username=install&password=install&redirect=false'

# 2. Read the CSRF token from the cookies file (column 7)
TOKEN=$(grep X-Bonita-API-Token cookies.txt | awk '{print $7}')

# 3. Upload the ZIP via the page resource API
curl -b cookies.txt -X POST \
  'http://localhost:8080/bonita/portal/pageUpload' \
  -H "X-Bonita-API-Token: $TOKEN" \
  -F "page=@dist/page-{name}.zip"

# 4. Logout
curl -b cookies.txt -X GET 'http://localhost:8080/bonita/logoutservice'
```

The `pageUpload` endpoint returns a JSON response with the path to the temporarily-uploaded file. To then *register* it as a page, you typically follow up with a POST to `/API/portal/page` referencing that path. Subscription customers can also use the dedicated import API.

For most cases the Admin UI (Path A) or Studio import (Path B) is faster. Use REST automation only when you need it (CI/CD, multi-environment promotion).

---

## Updating an existing page

To deploy a new version of an already-uploaded page:

1. Build a new ZIP whose `page.properties.name` matches the existing page (e.g., both are `custompage_taskViewer`).
2. Upload the same way (Resources → Add).
3. Bonita detects the matching name and prompts:
   > *A page with this name already exists. Replace it?*
4. Click **Yes**.
5. The resource is replaced atomically. **Application bindings are preserved** — you don't need to re-add the page to applications.

### Browser cache

Vite and Angular hash the asset filenames (`index-{hash}.js`). When you upload a new ZIP, the new filenames are different, so browsers fetch them fresh — no manual cache busting required.

`index.html` itself is **not** hashed. Bonita serves it with default Tomcat caching headers (usually `no-cache`). If you see a stale page, force-refresh (Ctrl+F5 / Cmd+Shift+R).

---

## Removing a page

1. **Resources** → find the page → **Delete**
2. Bonita warns if it's used by any Application — confirm to remove
3. The page is unregistered and the underlying ZIP deleted

If you only want to take it offline temporarily, remove it from the Application's Pages tab instead — the resource itself remains.

---

## Profiles & permissions

A page is only visible to users who have access to an Application that contains it. Application access is governed by **Profiles**:

| Profile | Default users |
|---------|---------------|
| Administrator | `install` and members of the admin role |
| User | All non-admin users |
| Process manager | Users assigned as supervisors |
| Custom profiles | Define under **Organization → Profiles** |

When creating an Application, pick the profile that should see it. Members of that profile will see the application listed in their Portal navigation menu.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Failed to import page" | Bad ZIP structure | Verify with `unzip -l` — `page.properties` must be at root, build under `resources/` |
| Page imports but blank screen | Absolute asset paths in build | Vite: ensure `base: './'`. Angular: ensure `"baseHref": "./"` in angular.json |
| 404 on assets | ZIP missing `resources/` wrapper | Re-check the packaging script — assets must be under `resources/` |
| Routes 404 on hard refresh | Browser/HTML5 routing instead of hash | React: `createHashRouter`. Vue: `createWebHashHistory`. Angular: `withHashLocation()` |
| Login API works but session probe returns 401 | App running outside Portal iframe (dev only) | Expected in standalone dev — show login page |
| API returns 401 on every call | `credentials: 'include'` missing | Check fetch options / Angular interceptor `withCredentials: true` |
| API returns 403 on POST/PUT/DELETE | CSRF token missing or doesn't match cookie | Check the API client reads the `X-Bonita-API-Token` cookie and decodes it |
| Page in Resources but not in Application dropdown | `contentType` not set to `page` | Edit `page.properties` and re-upload |
| Resource won't register | Bonita logs (`logs/bonita.log`) show a `page.properties` parse error | Open the log file, the error line points at the offending field |
| Multiple ZIPs with same name conflict | Each ZIP uses the same `name` | Bonita requires unique names — change in `page.properties` |

If the page imports but you get a Tomcat 404 when navigating to `/bonita/apps/{appToken}/{pageToken}/`:
- Check the application token spelling
- Check the page is actually added to the application's Pages tab
- Check the page token spelling
- Reload the Portal (the app navigation cache may be stale)

---

## Production checklist

Before deploying to production:

- [ ] `page.properties` has a meaningful `name`, `displayName`, `description`
- [ ] Build runs cleanly with no warnings
- [ ] Bundle size is reasonable (Vite reports it; Angular has budgets)
- [ ] CSP meta tag is present in `index.html`
- [ ] Login and session probe both work in dev against the staging Bonita
- [ ] At least one full user flow tested in dev mode
- [ ] No hard-coded `http://localhost:8080` anywhere in the source
- [ ] No console errors on first load
- [ ] Logout works and returns to a sensible state

For multi-tenant Subscription deployments, repeat the upload per tenant or script it via Path C (REST API).

---

## See also

- [Architecture](skills/bonita-custom-page/references/architecture.md)
- [Bonita REST APIs](skills/bonita-custom-page/references/bonita-apis.md)
- [Auth & CSRF deep dive](skills/bonita-custom-page/references/auth-csrf.md)
- [`page.properties` reference](skills/bonita-custom-page/references/page-properties.md)
- [ZIP packaging script](skills/bonita-custom-page/references/zip-packaging.md)
