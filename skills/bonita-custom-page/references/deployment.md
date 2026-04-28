# Deployment — uploading and using the custom page in Bonita

This is the universal deployment process. It applies identically to React, Vue and Angular ZIPs.

> **Bonita 2025.x users**: the legacy `/bonita/portal/admin` UI is **gone**. Administration moved to two Living Applications — **`superAdminAppBonita`** (platform admin) and **`adminAppEEBonita`** (tenant admin). Skip directly to **Option A2** below.
>
> A standalone, more detailed walkthrough specifically for 2025.x lives at [`../../../DEPLOY_2025.md`](../../../DEPLOY_2025.md).

## Prerequisites

- A running Bonita instance (Studio, Tomcat bundle, Subscription Edition, or Docker)
- Admin access (`install`/`install` for Studio, or your tenant admin account)
- A built ZIP from `npm run build:bonita`

## Option A1 — Bonita ≤ 7.x (legacy Portal)

This is the older Bonita Portal UI used by 7.x and earlier.

### 1. Upload the page resource

1. Open Bonita Portal: `http://localhost:8080/bonita/`
2. Log in as Admin
3. Go to **Resources** in the admin menu
4. Click **Add** (top-right) → select your `page-{name}.zip`
5. Bonita reads `page.properties` and registers the resource
6. Verify: the page appears in the list with its `displayName`

### 2. Add the page to a Living Application

1. Go to **Applications**
2. Click an existing application or create a new one (Token, Display name, Profile)
3. Open the application → **Pages** tab → **Add**
4. Pick your page from the dropdown
5. Set a **Token** for this page within the app
6. Optionally mark it as **Home page**

### 3. Access the page

```
http://localhost:8080/bonita/apps/{appToken}/{pageToken}/
```

## Option A2 — Bonita 2024.x / 2025.x (current)

The legacy Portal admin UI was removed. Administration now lives in two Living Applications:

| Operation | Super Admin (platform) | Admin EE (tenant) |
|-----------|------------------------|-------------------|
| Upload page ZIP | `/bonita/apps/superAdminAppBonita/resource-list/` | `/bonita/apps/adminAppEEBonita/admin-resource-list/` |
| List applications | `/bonita/apps/superAdminAppBonita/application-list/` | `/bonita/apps/adminAppEEBonita/admin-application-list/` |
| Edit one application | `/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}` | `/bonita/apps/adminAppEEBonita/admin-application-details/?id={id}` |

### 1. Login

```
http://localhost:8080/bonita/login.jsp
```

### 2. Upload the page resource

Open the resource list (Super Admin or Admin EE). Click **+ Add a resource** and upload `page-{name}.zip`. Bonita reads `page.properties` and registers the page.

### 3. Create the application (recommended) or pick an existing one

Open the application list and click **+ Create application**. Set:
- **Token** — e.g. `myApp` (segment in the URL)
- **Display name**
- **Profile** — the profile your test user has
- **Layout** — **`Layout Without Menu`** ← important for full-screen SPAs (see below)

### 4. Bind the page to the application

Open the application details (`admin-application-details/?id={id}`):
1. **Pages** section → **+ Add page**
2. Pick the uploaded page
3. Set the **Token** within the app (e.g. `home`)
4. Save (optionally mark as Home page)

### 5. Access the page

```
http://localhost:8080/bonita/apps/{appToken}/{pageToken}/?_l=en
```

Example: `http://localhost:8080/bonita/apps/myApp/home/?_l=en`

## Why "Layout Without Menu" matters

A Bonita Application's **Layout** is the HTML shell that wraps every page belonging to that app. The default layout includes a Bonita header, side menu and breadcrumb — useful for traditional Living Applications, but it constrains a full-screen SPA into a small frame.

`Layout Without Menu` is a built-in layout (shipped with Bonita 2025.x) that contains only the content slot, no chrome. Pick it for any custom-page SPA that should fill the viewport — task viewers, dashboards, kanban boards, anything not designed to live inside Bonita's standard navigation.

If you forget this, the symptom is "my SPA appears squeezed inside the Bonita admin shell". The fix is to edit the Application and change the Layout — no need to rebuild the ZIP.

## Option B — Deploy via Bonita Studio (development)

Bonita Studio has a faster loop for development:

1. Open Studio
2. **Development** menu → **Manage REST API extensions and Pages** (or **Manage API extensions** depending on version)
3. Click **Import** → select your ZIP
4. Studio imports it into the embedded Tomcat
5. Access via the same URL pattern

The Studio's embedded Tomcat lives at `http://localhost:8080/bonita/` by default.

## Option C — Deploy via Bonita BPMS Engine REST API

For CI/CD pipelines, automate the upload:

```bash
# 1. Login to get session cookies
curl -c cookies.txt -X POST 'http://localhost:8080/bonita/loginservice' \
  -d 'username=install&password=install&redirect=false'

# 2. Read the CSRF token from cookies.txt
TOKEN=$(grep X-Bonita-API-Token cookies.txt | awk '{print $7}')

# 3. Upload the ZIP
curl -b cookies.txt -X POST 'http://localhost:8080/bonita/portal/pageUpload' \
  -H "X-Bonita-API-Token: $TOKEN" \
  -F "page=@dist/page-taskViewer.zip"

# 4. Logout
curl -b cookies.txt -X GET 'http://localhost:8080/bonita/logoutservice'
```

The endpoint `pageUpload` returns the temporary upload path; you then need a follow-up call to register it. For most cases the Admin UI or Studio import is simpler — use the REST path only for automated pipelines.

## Updating an existing page

To deploy a new version of the same page:

1. Build a new ZIP with the **same `name` in `page.properties`**
2. Upload via the same Resources → Add flow
3. Bonita detects the matching name and prompts: "A page with this name already exists. Replace it?" → Yes
4. The resource is replaced atomically

The application bindings are preserved (you don't have to re-add the page to applications).

## Cache busting

Vite/Angular hash the asset filenames (`index-{hash}.js`). When you upload a new ZIP, the new filenames are different, so browsers fetch them fresh — no manual cache busting needed.

`index.html` itself is NOT hashed. Bonita serves it with default Tomcat caching headers, which usually means no caching. If you see stale HTML, force-refresh (Ctrl+F5).

## Profiles & permissions

A page is only visible to users who have access to an Application that contains the page. Application access is controlled by **Profiles**:

| Profile | Default users |
|---------|---------------|
| Administrator | `install` and members of the admin role |
| User | All non-admin users |
| Process manager | Users assigned as supervisors |
| Custom profiles | Define in **Organization** → **Profiles** |

When creating an Application, pick the profile that should see it. Members of that profile will see the application in their portal navigation menu.

## Removing a page

1. **Resources** → find the page → **Delete**
2. Bonita warns if it's used by any Application — confirm to remove
3. The page is unregistered and the underlying ZIP deleted from disk

## Common deployment issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Failed to import page" | Bad ZIP structure | Check `page.properties` is at root, build under `resources/` |
| Page shows but blank | Absolute paths in build | Set `base: './'` (Vite) or `baseHref: './'` (Angular) |
| 404 on assets | ZIP missing `resources/` wrapper | Inspect ZIP contents — assets must be under `resources/` |
| Routes 404 on refresh | Browser/HTML5 routing | Switch to hash routing |
| API 401 after login | Missing `X-Bonita-API-Token` header | Ensure CSRF token sent on writes |
| API 401 on session probe | Running outside Portal iframe in dev | Show login page in dev mode |
| Page not in Application list | Resource didn't register | Check Bonita logs (`logs/bonita.log`) for `page.properties` parse errors |

## Production deployment (Bonita Subscription)

In a production Bonita cluster:

1. The same ZIP works
2. Upload via the production Bonita Portal (or the Bonita REST API in CI/CD)
3. The resource is replicated across cluster nodes
4. Browser cache is invalidated automatically (filename hashes)
5. Zero downtime — uploads are atomic

For multi-tenant deployments, each tenant has its own Resources storage. Upload separately per tenant, or script it.
