# Deploying a custom page on Bonita 2025.x

> Verified URLs and tokens in this guide come from a real Bonita 2025.2 instance running on `localhost:29106`. The legacy "Bonita Portal" UI (`/bonita/portal/admin`) is **gone** in 2025.x — that's almost certainly why an older guide didn't work. Administration is split across two Living Applications now: **Super Admin** and **Admin (EE)**.

The example URL throughout this doc is the one we're targeting:

```
http://localhost:29106/bonita/apps/appDirectoryBonita/home/?_l=en
```

`appDirectoryBonita` is **a custom Living Application** (not provided out-of-the-box by Bonita) — you create it once and bind your custom page to it. Adjust the host/port for your own runtime.

---

## 1. Bonita 2025.x admin apps — which one to use

| App token | URL prefix | Purpose |
|-----------|-----------|---------|
| `superAdminAppBonita` | `/bonita/apps/superAdminAppBonita/` | **Platform-level** admin: pages, resources, applications across the platform. Uses paths like `resource-list`, `application-list`, `admin-application-details`. |
| `adminAppEEBonita` | `/bonita/apps/adminAppEEBonita/` | **Tenant-level** admin (Enterprise Edition). Same operations but the page tokens are prefixed with `admin-`: `admin-resource-list`, `admin-application-list`, `admin-application-details`. |

Both can do the deployment. Use whichever matches your role — typically a tenant administrator goes through `adminAppEEBonita`, a platform administrator can use either.

The screen names you'll need:

| What you do | Super Admin URL | Admin EE URL |
|-------------|-----------------|--------------|
| Upload custom page ZIP | `/bonita/apps/superAdminAppBonita/resource-list/` | `/bonita/apps/adminAppEEBonita/admin-resource-list/` |
| List applications | `/bonita/apps/superAdminAppBonita/application-list/` | `/bonita/apps/adminAppEEBonita/admin-application-list/` |
| Edit one application | `/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}` | `/bonita/apps/adminAppEEBonita/admin-application-details/?id={id}` |
| Admin home | — | `/bonita/apps/adminAppEEBonita/home/` |

---

## 2. Build the ZIP first

```bash
cd examples/react-directory-bonita
./build.sh           # macOS / Linux / Git Bash
build.bat            # Windows cmd
```

You should now have:

```
dist/page-appDirectoryBonitaHome.zip
```

Verify the structure (this is the #1 cause of "import failed"):

```bash
unzip -l dist/page-appDirectoryBonitaHome.zip
# Expected:
#   page.properties           ← MUST be at root
#   resources/index.html
#   resources/assets/index-XXXX.js
#   resources/assets/index-XXXX.css
```

---

## 3. Recommended path — new application + no-menu layout

The **cleanest** result (full-bleed SPA with no Bonita chrome around it) is to:

1. Upload your custom page (`contentType=page`)
2. Upload (or reuse) a "no-menu" layout (`contentType=layout`)
3. Create a new Application that uses that layout
4. Bind the page to the new Application as `home`

Step by step on Bonita 2025.x (Super Admin path; Admin EE is identical with `admin-` prefixes):

### 3.1 Upload the page

```
http://localhost:29106/bonita/apps/superAdminAppBonita/resource-list/
```

1. Click **+ Add a resource**
2. Select `dist/page-appDirectoryBonitaHome.zip`
3. Confirm — the page appears in the list with displayName `Directory Bonita Home` and type `Page`

### 3.2 Upload (or pick) the layout

A **layout** is a separate ZIP whose `page.properties` declares `contentType=layout`. It defines the HTML shell into which Bonita injects each page's content.

If you already have a no-menu layout uploaded, skip ahead. Otherwise, build a minimal one:

```
no-menu-layout/
├── page.properties
└── resources/
    ├── layout.html
    └── assets/style.css
```

`page.properties`:
```properties
name=custompage_noMenuLayout
displayName=No-menu Layout
description=Empty Bonita layout — content fills the iframe with no header or menu
contentType=layout
```

`resources/layout.html` (the `<pb-content>` placeholder is the content slot — Bonita injects the page there):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ application.displayName }}</title>
    <link rel="stylesheet" href="assets/style.css" />
  </head>
  <body>
    <pb-content></pb-content>
  </body>
</html>
```

`resources/assets/style.css`:
```css
html, body { margin: 0; padding: 0; height: 100dvh; background: #f3f3f1; }
pb-content { display: block; height: 100dvh; }
```

ZIP it the same way (`page.properties` at root, all assets under `resources/`) and upload via **resource-list** as well. Bonita will register it as a layout.

> The exact placeholder syntax for the content slot has varied across Bonita versions (`<pb-content>`, `<div data-token="content"></div>`, AngularJS `<ui-view>`). If `<pb-content>` doesn't render, check Bonita 2025.2 documentation for the current syntax — drop the line into your layout, re-zip, re-upload.

### 3.3 Create the Application

```
http://localhost:29106/bonita/apps/superAdminAppBonita/application-list/
```

1. Click **+ Create application** (or whatever the "Add" CTA reads)
2. Fill in:
   - **Token**: `appDirectoryBonita` ← this is the `{appToken}` in the URL
   - **Display name**: `Directory Bonita`
   - **Description**: free text
   - **Profile**: pick the profile that should see the app (User, Administrator, or a custom profile)
   - **Layout**: `No-menu Layout` (the one uploaded in 3.2). For a default Bonita layout with menu, leave it as-is.
3. Save — the new app appears in the list with an `id` (e.g., `id=14`)

### 3.4 Bind the page to the application

```
http://localhost:29106/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}
```

Replace `{id}` with the id of the application you just created.

1. Open the **Pages** section (it might be a tab or a panel)
2. Click **+ Add page**
3. Select `Directory Bonita Home` from the dropdown
4. Set **Token** to `home` ← this is the `{pageToken}` in the URL
5. Save

Optionally, mark this page as the **Home page** (so `/bonita/apps/appDirectoryBonita/` redirects to `/bonita/apps/appDirectoryBonita/home/`).

### 3.5 Access it

```
http://localhost:29106/bonita/apps/appDirectoryBonita/home/?_l=en
```

If it works → **listo**. If 404, jump to §6 Troubleshooting.

---

## 4. Alternative path — reuse the existing Bonita Administrator Application

If you don't want to create a new application and just want the page available **inside the existing Bonita Administrator Application** (less clean — you'll see the admin chrome around your SPA), you can add it directly there.

Open the admin application's details from the Super Admin or the Admin EE app:

```
http://localhost:29106/bonita/apps/superAdminAppBonita/admin-application-details/?id=3
```

(`id=3` is typically the "Bonita Administrator Application" — verify in the application-list of your install; the id may differ.)

Same flow as 3.4: Pages → +Add → pick `Directory Bonita Home` → token `home` → save.

Then, when you log in as an administrator, you can access the page either at:

```
http://localhost:29106/bonita/apps/adminAppEEBonita/home/                  # the admin home
http://localhost:29106/bonita/apps/adminAppEEBonita/admin-application-list/   # the admin lists
http://localhost:29106/bonita/apps/adminAppEEBonita/admin-application-details/?id=3
```

…or at whatever token you bound your page to (e.g. `/bonita/apps/adminAppEEBonita/home/` if you bound it as `home`).

The downside: the admin app's menu and header still wrap your SPA. **Path 3 is recommended** for production-style deployments.

---

## 5. Path C — REST API (CI/CD, scripted)

For automated pipelines. Two-step upload: first POST to a temp location, then register as a page.

```bash
#!/usr/bin/env bash
set -e

BONITA="http://localhost:29106"
USERNAME="install"
PASSWORD="install"
ZIP="dist/page-appDirectoryBonitaHome.zip"

COOKIES=$(mktemp)

# 1. Login
curl -sf -c "$COOKIES" -X POST "$BONITA/loginservice" \
  -d "username=$USERNAME&password=$PASSWORD&redirect=false"

# 2. Read the CSRF token from the cookie jar
TOKEN=$(awk '$6=="X-Bonita-API-Token"{print $7}' "$COOKIES")
if [ -z "$TOKEN" ]; then echo "No CSRF token after login"; exit 1; fi

# 3. Upload to temp location — returns the temp file name as plain text
TEMP_NAME=$(curl -sf -b "$COOKIES" -X POST \
  "$BONITA/portal/pageUpload" \
  -H "X-Bonita-API-Token: $TOKEN" \
  -F "page=@$ZIP")

echo "Temp upload: $TEMP_NAME"

# 4. Register the page (POST = create new; PUT = update existing)
curl -sf -b "$COOKIES" -X POST \
  "$BONITA/API/portal/page" \
  -H "X-Bonita-API-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contentName\":\"page-appDirectoryBonitaHome.zip\",\"tempContentName\":\"$TEMP_NAME\"}"

# 5. Logout
curl -sf -b "$COOKIES" -X GET "$BONITA/logoutservice"
rm -f "$COOKIES"
echo "Page deployed. Now bind it via the Super Admin or Admin EE UI."
```

The REST API uploads the **page resource** but does NOT bind it to an application — that step still needs the UI (or a separate `POST /API/living/application-page` call referencing your app id and the page id, which is messier). For most workflows: REST for the resource upload, UI for the application binding.

### Updating an existing page via REST

To replace a page (same `name` in `page.properties`):

```bash
PAGE_ID=$(curl -sf -b "$COOKIES" \
  "$BONITA/API/portal/page?f=name=custompage_appDirectoryBonitaHome" \
  -H "X-Bonita-API-Token: $TOKEN" \
  | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -sf -b "$COOKIES" -X PUT \
  "$BONITA/API/portal/page/$PAGE_ID" \
  -H "X-Bonita-API-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contentName\":\"page-appDirectoryBonitaHome.zip\",\"tempContentName\":\"$TEMP_NAME\"}"
```

Application bindings are preserved — no need to re-add the page.

---

## 6. Troubleshooting (Bonita 2025.x)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/bonita/portal/admin` → 404 | Old Portal UI removed in 2024.x+ | Use `superAdminAppBonita` or `adminAppEEBonita` |
| `/bonita/apps/adminApp/` → 404 | Wrong app token (older drafts of this guide had it wrong) | Real tokens: `superAdminAppBonita` or `adminAppEEBonita` |
| `/bonita/apps/superAdminAppBonita/` → 404 | Your runtime uses different application names (some custom builds rename them) | Open `/bonita/apps/` (no token) — Bonita lists the apps your user can access. Pick the one with "Super Admin" / "Administrator" in the displayName. |
| Resource-list / application-list shows blank | User lacks Administrator/Super Admin profile | Login as `install` (default Studio admin) or have your tenant admin grant the right profile |
| Page imports but doesn't appear in any application | Forgot to bind it (step 3.4) | Open `admin-application-details/?id={id}` of your app → Pages → +Add |
| Application created but `/bonita/apps/{token}/` 404s | Token typo or app not assigned a profile your user has | Re-check the token spelling exactly (case-sensitive); confirm your user has the application's profile |
| Application loads but page shows the admin layout chrome | Layout = default Bonita admin layout | Pick the "No-menu Layout" you uploaded, or any custom layout, in the Application's settings |
| `<pb-content>` placeholder renders literally | Wrong placeholder syntax for your Bonita version | Try `<div data-token="content"></div>` instead, re-zip, re-upload the layout |
| Page works but blank screen | Vite built with absolute paths | `base: './'` in `vite.config.ts` (already configured in this example) |
| Hard refresh on a sub-route 404s | Browser routing instead of hash | `createHashRouter` (already configured) |
| API calls return 401 in production | `credentials: 'include'` missing | Already set in `src/api/client.ts` — confirm via DevTools network tab |
| 403 on POST/PUT/DELETE | CSRF token not echoed | Already handled — confirm `X-Bonita-API-Token` is in headers |
| `_l=en` query strips on navigation | Bonita injects locale on first load only; subsequent in-iframe nav uses your hash | Expected behaviour |

---

## 7. Quick checklist

Before declaring a deployment failure:

- [ ] ZIP layout verified with `unzip -l` (`page.properties` at root, `resources/index.html`)
- [ ] Logged in with a profile that has Super Admin or Admin EE access
- [ ] Page resource uploaded (`Directory Bonita Home` shows in resource-list)
- [ ] Layout uploaded if you want a no-menu shell (or default layout selected)
- [ ] Application created in application-list with token `appDirectoryBonita`
- [ ] App's Profile assigned and your test user belongs to it
- [ ] Page bound to the app in `admin-application-details/?id={id}` with token `home`
- [ ] Hard-refresh after upload (Ctrl+F5) to bust browser cache

When all check, accede a:

```
http://localhost:29106/bonita/apps/appDirectoryBonita/home/?_l=en
```

y listo.

---

## 8. Diagnostic — isolate which step fails

Run each curl one at a time to find the first failure:

```bash
# 1. Login — should return 200, no body
curl -i -c /tmp/c.txt -X POST 'http://localhost:29106/bonita/loginservice' \
  -d 'username=install&password=install&redirect=false'

# 2. Read your own session — should return JSON with user_id
TOKEN=$(awk '$6=="X-Bonita-API-Token"{print $7}' /tmp/c.txt)
curl -i -b /tmp/c.txt \
  -H "X-Bonita-API-Token: $TOKEN" \
  'http://localhost:29106/bonita/API/system/session/unusedId'

# 3. List applications — should return a JSON array including appDirectoryBonita
curl -i -b /tmp/c.txt \
  -H "X-Bonita-API-Token: $TOKEN" \
  'http://localhost:29106/bonita/API/living/application?p=0&c=50'

# 4. List uploaded pages — should include custompage_appDirectoryBonitaHome
curl -i -b /tmp/c.txt \
  -H "X-Bonita-API-Token: $TOKEN" \
  'http://localhost:29106/bonita/API/portal/page?p=0&c=50&f=name=custompage_appDirectoryBonitaHome'

# 5. List page bindings on your application
#    First find the app id from step 3, then:
APP_ID=14    # ← replace with your appDirectoryBonita id
curl -i -b /tmp/c.txt \
  -H "X-Bonita-API-Token: $TOKEN" \
  "http://localhost:29106/bonita/API/living/application-page?f=applicationId=$APP_ID"
```

Whichever step is the first to return non-200, paste its response and I can pinpoint the issue.
