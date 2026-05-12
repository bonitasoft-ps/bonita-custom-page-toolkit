# `bonita-page` CLI reference

The toolkit ships a single binary `bonita-page` — used **without** any AI by:
- Developers who want to scaffold a new Bonita custom page in a known framework
- Clients who already have a React/Vue/Angular/Svelte/Solid/Qwik app and want to package it as a Bonita custom page
- CI/CD pipelines that need to build / package / validate ZIPs

The same code is invoked by the MCP tools (`scaffold_custom_page`, `wrap_existing_app`, ...) so behaviour is identical whether you run the CLI yourself or ask Claude to do it via MCP.

---

## Installation

The toolkit doesn't need a global `npm install -g`. Two options:

### Option 1 — clone and run directly

```bash
git clone https://github.com/bonitasoft-ps/bonita-custom-page-toolkit.git
cd bonita-custom-page-toolkit

# Linux / macOS / Git Bash
./bonita-page.sh help

# Windows cmd
bonita-page.bat help
```

The wrapper scripts call `node scripts/cli.js` internally and check that Node 20+ is installed.

### Option 2 — npm link (for repeated use)

```bash
cd bonita-custom-page-toolkit
npm install
npm link

# Now `bonita-page` is on your PATH
bonita-page help
```

---

## Subcommands

```
bonita-page <command> [options]

  prepare     ALL-IN-ONE: check + wrap + npm install + build → ZIP + deploy docs
  scaffold    Create a NEW Bonita custom page project from a framework template
  wrap        Take an EXISTING SPA and add the Bonita custom-page layer
  check       Pre-flight check: read-only verification of a project
  validate    Verify a custom-page ZIP has the layout Bonita requires
  build       Run npm install + build:bonita on a project
  help        Show usage
```

---

## `prepare` — one-shot pipeline (happy path)

Runs the full pipeline for an EXISTING SPA in one call: `check` → `wrap` → `npm install` (if needed) → `npm run dist`. Stops at the first failed stage with a structured reason.

```bash
bonita-page prepare \
    --name=<camelCase> \
    --app-token=<camelCase> \
    [--display-name="<text>"] \
    [--page-token=<token>] \
    [--framework=<react|vue|angular|svelte|solid|qwik>] \
    [--target-dir=<path>] \
    [--skip-check] \
    [--skip-install]
```

### Required flags

| Flag | Format | Notes |
|------|--------|-------|
| `--name` | `[a-zA-Z][a-zA-Z0-9]*` | Internal page name. Becomes `custompage_<name>` and `page-<name>.zip`. |
| `--app-token` | `[a-zA-Z][a-zA-Z0-9]*` | Bonita Application token. URL: `/bonita/apps/{appToken}/{pageToken}/` |

### Optional flags

| Flag | Default | Notes |
|------|---------|-------|
| `--display-name` | same as `--name` | Free text shown in Bonita admin |
| `--page-token` | `home` | Page token within the app |
| `--framework` | auto-detected | From `package.json` / `angular.json`. Override only if detection fails. |
| `--target-dir` | cwd | Path of the existing project. Must contain `package.json` (or `angular.json`). |
| `--skip-check` | `false` | Proceed even if `check` reports issues. Use only after acknowledging the warnings. |
| `--skip-install` | `false` | Skip `npm install` even if `node_modules` is missing. Useful for monorepos. |

### Example

```bash
cd /path/to/existing-app
bonita-page prepare \
    --name=clientDashboard \
    --display-name="Client Dashboard" \
    --app-token=clientApp
```

Output on success (JSON):
```json
{
  "ok": true,
  "framework": "Vue 3 + Vite",
  "name": "clientDashboard",
  "appToken": "clientApp",
  "pageToken": "home",
  "projectDir": "/abs/path/to/existing-app",
  "zipPath": "/abs/path/to/existing-app/dist/page-clientDashboard.zip",
  "docs": {
    "md":   "/abs/path/.../dist/DEPLOY-README.md",
    "html": "/abs/path/.../dist/DEPLOY-README.html"
  },
  "nextSteps": ["..."],
  "stages": [
    { "stage": "check",   "ok": true, "summary": { /* … */ } },
    { "stage": "wrap",    "ok": true, "summary": { /* … */ } },
    { "stage": "install", "ok": true },
    { "stage": "dist",    "ok": true }
  ]
}
```

Output on failure (JSON, exit 1):
```json
{
  "ok": false,
  "stoppedAt": "check",
  "reason": "Project failed pre-flight checks. Fix the issues below in src/ and re-run, or pass --skip-check to proceed anyway.",
  "issues": ["src/router.tsx: createBrowserRouter found — use createHashRouter."],
  "stages": [{ "stage": "check", "ok": false, "summary": { /* … */ } }]
}
```

`stoppedAt` is one of `check | wrap | install | dist`. Read `WRAP-CHECKLIST.md` (or its [Castellano](WRAP-CHECKLIST.es.md) / [Français](WRAP-CHECKLIST.fr.md) versions) for the full rule set behind the `check` stage.

---

## `scaffold` — create a new project

Creates a fresh Bonita custom page in any of the six supported frameworks.

```bash
bonita-page scaffold \
    --framework=<react|vue|angular|svelte|solid|qwik> \
    --name=<camelCase> \
    --display-name="<text>" \
    --app-token=<camelCase> \
    [--page-token=<token>] \
    [--target-dir=<path>]
```

### Required flags

| Flag | Format | Notes |
|------|--------|-------|
| `--framework` | one of `react`, `vue`, `angular`, `svelte`, `solid`, `qwik` | The template to copy from `templates/` |
| `--name` | `[a-zA-Z][a-zA-Z0-9]*` | Internal page name. Becomes `custompage_<name>` and the ZIP filename. |
| `--app-token` | `[a-zA-Z][a-zA-Z0-9]*` | Bonita Application token. URL: `/bonita/apps/{appToken}/{pageToken}/` |

### Optional flags

| Flag | Default | Notes |
|------|---------|-------|
| `--display-name` | same as `--name` | Free text shown in Bonita admin |
| `--page-token` | `home` | Page token within the app |
| `--target-dir` | `./<name>` | Where to create the project. Must NOT exist. |

### Example

```bash
bonita-page scaffold \
    --framework=svelte \
    --name=invoiceDashboard \
    --display-name="Invoice Dashboard" \
    --app-token=invoiceApp \
    --page-token=home \
    --target-dir=../invoice-dashboard
```

Output (on stdout, JSON):
```json
{
  "framework": "Svelte 5 + Vite",
  "name": "invoiceDashboard",
  "displayName": "Invoice Dashboard",
  "appToken": "invoiceApp",
  "pageToken": "home",
  "projectDir": "/abs/path/to/invoice-dashboard",
  "pagePropertiesName": "custompage_invoiceDashboard",
  "deployUrl": "http://{your-bonita-host}/bonita/apps/invoiceApp/home/?_l=en",
  "nextSteps": ["cd ...", "npm install", "npm run dist", ...]
}
```

The created project includes:
- `src/` with login + tasks + auth store + API client (the same scenario as the `directory-bonita` examples, in the chosen framework)
- `page.properties` with the substituted name and display name
- `scripts/package-bonita.js` and `scripts/copy-docs.js`
- `docs/DEPLOY-README.{md,html}` — multilingual EN/FR/ES guides
- `build.sh` and `build.bat`
- `package.json` with `dist` script wired

---

## `wrap` — convert an existing SPA into a Bonita custom page

Takes a project the user already has (their own React/Vue/Angular/Svelte/Solid/Qwik app) and adds the Bonita layer **without modifying their existing code**:

- `page.properties` at the root
- `scripts/package-bonita.js` + `scripts/copy-docs.js`
- `docs/DEPLOY-README.{md,html}` (multilingual)
- `build.sh` + `build.bat`
- `dist` and `build:bonita` scripts in `package.json`
- `archiver` (and `cross-env` for Angular) added as devDependencies

It also **verifies** key configurations and emits warnings (not errors) if it finds issues:

- Vite `base` should be `'./'`
- Angular `baseHref` should be `'./'`
- Hash routing instead of browser routing
- `withCredentials` set on HTTP requests

```bash
bonita-page wrap \
    --name=<camelCase> \
    --app-token=<camelCase> \
    [--framework=<framework>] \
    [--display-name="<text>"] \
    [--page-token=<token>] \
    [--target-dir=<path>]
```

### Required flags

| Flag | Notes |
|------|-------|
| `--name` | The Bonita page name (without `custompage_` prefix) |
| `--app-token` | Bonita Application token |

### Optional flags

| Flag | Default | Notes |
|------|---------|-------|
| `--framework` | auto-detected | Read from `package.json`/`angular.json`. Pass explicitly if detection fails. |
| `--display-name` | same as `--name` | |
| `--page-token` | `home` | |
| `--target-dir` | current working dir | Path of the existing project to wrap. Must already exist. |

### Example

```bash
cd /path/to/existing-react-app
bonita-page wrap --name=clientDashboard --app-token=clientApp
```

Output (on stdout, JSON):
```json
{
  "framework": "React",
  "projectDir": "/path/to/existing-react-app",
  "name": "clientDashboard",
  "displayName": "clientDashboard",
  "appToken": "clientApp",
  "pageToken": "home",
  "pagePropertiesName": "custompage_clientDashboard",
  "zipName": "page-clientDashboard.zip",
  "filesCreated": ["page.properties", "scripts/package-bonita.js", ...],
  "warnings": [
    "vite.config.ts: Vite `base` should be './' (or computed for build). Without it, deployed assets 404.",
    "Found .../src/router.tsx — must use createHashRouter / HashRouter for refresh-safe deployment in Bonita."
  ],
  "nextSteps": ["npm install", "npm run dist", ...]
}
```

If warnings are non-empty, **review them with the user** — they signal config the wrapper can't fix automatically (it doesn't modify their source code).

### What `wrap` does NOT do

- Doesn't change your routing code (won't replace `BrowserRouter` with `HashRouter`)
- Doesn't change your Vite/Angular base path (just warns)
- Doesn't add an HTTP CSRF interceptor if missing (warns)
- Doesn't write to your `src/` at all — only adds new files at the project root, `scripts/`, and `docs/`

The user is expected to apply the warnings manually (with the help of the framework-specific skill if they're using AI).

---

## `check` — pre-flight verification (read-only)

Verifies an existing project conforms to the rules in [`WRAP-CHECKLIST.md`](WRAP-CHECKLIST.md). Reads the project's files, modifies nothing, and returns a JSON report. Use it BEFORE `wrap` (and again in CI).

```bash
bonita-page check [project-dir]   # default: cwd
```

### Example — passing project

```bash
$ bonita-page check examples/react-directory-bonita
{
  "ok": true,
  "framework": "react",
  "projectDir": "/abs/path/...",
  "checks": {
    "buildOutputExists": true,
    "relativeBasePath": true,
    "hashRouting": true,
    "credentialsInclude": true
  },
  "issues": []
}
# Exit code: 0
```

### Example — project with issues

```bash
$ bonita-page check ./my-broken-app
{
  "ok": false,
  "framework": "react",
  "projectDir": "/abs/my-broken-app",
  "checks": {
    "buildOutputExists": true,
    "relativeBasePath": false,
    "hashRouting": false,
    "credentialsInclude": false
  },
  "issues": [
    "vite.config.ts: `base` is not \"./\" (or a command-aware variant). Deployed assets will 404. Set `base: './'`.",
    "Hash routing not detected. react requires createHashRouter for refresh-safe deployment in Bonita.",
    "Found .../src/router.tsx — replace browser routing with hash routing.",
    "No fetch with credentials:'include' or HttpClient withCredentials found. Bonita session cookies won't be sent."
  ]
}
# Exit code: 1
```

### What `check` verifies

| Check | Description |
|-------|-------------|
| `buildOutputExists` | A `build`, `build:bonita`, or `dist` script in `package.json` exists |
| `relativeBasePath` | Vite `base: './'` (or computed) / Angular `baseHref: './'` |
| `hashRouting` | `createHashRouter` / `createWebHashHistory` / `withHashLocation` / `svelte-spa-router` / `HashRouter` (Solid). For Qwik (manual routing), this check is skipped. |
| `credentialsInclude` | Some file under `src/` contains `credentials: 'include'`, `withCredentials: true`, or sets `X-Bonita-API-Token` |

### Use in CI

```yaml
- run: npx bonita-page check
# Fails the step (exit 1) if any of the rules are violated.
```

This catches drift introduced by careless edits — e.g. someone replaces `createHashRouter` with `createBrowserRouter` because the dev mode "works fine" without realising it'll break in Bonita.

### Limitations

- Only does static text matching. A function called `createHashRouter` defined in user code (not from `react-router-dom`) would still pass the check.
- Doesn't verify CSP meta tag content (some directives are framework-specific — see WRAP-CHECKLIST §7).
- Doesn't run the build itself. If your project has a syntax error, `check` may still pass — you'll find out at `wrap` or `build` time.

For a more thorough manual review, read [`WRAP-CHECKLIST.md`](WRAP-CHECKLIST.md) and audit `src/` against it.

---

## `validate` — check a ZIP before uploading

Catches the most common packaging mistakes BEFORE you waste time uploading to Bonita.

```bash
bonita-page validate <path-to-zip>
```

### Example

```bash
bonita-page validate dist/page-clientDashboard.zip
```

Output (JSON):
```json
{
  "valid": true,
  "name": "custompage_clientDashboard",
  "displayName": "Client Dashboard",
  "contentType": "page",
  "fileCount": 5,
  "issues": []
}
```

If invalid:
```json
{
  "valid": false,
  "fileCount": 12,
  "issues": [
    "page.properties is NOT at the ZIP root (Bonita requires it there).",
    "page.properties: name=\"myApp\" must start with \"custompage_\"."
  ]
}
```

Exit code: `0` if valid, `1` if not. Useful in CI:

```bash
bonita-page validate dist/page-*.zip || exit 1
```

### Requires `yauzl`

The validator uses [yauzl](https://www.npmjs.com/package/yauzl) (a tiny pure-JS unzip reader). It's listed in the toolkit's package.json. If you cloned the repo and ran `npm install` (or `npm link`), you have it. Otherwise install once:

```bash
npm install yauzl
```

Without yauzl, `validate` returns `{ valid: null, error: 'yauzl is not installed' }` and tells you what to install.

---

## `build` — install + build wrapper

Convenience wrapper. Useful for clients who don't want to remember "is it `npm run dist` or `./build.sh build`?". Handles missing `node_modules` automatically.

```bash
bonita-page build [project-dir]
```

Defaults to the current working directory.

### Example

```bash
bonita-page build /path/to/my-app
```

Output:
```json
{
  "project": "/path/to/my-app",
  "target": "dist",
  "zip": "/path/to/my-app/dist/page-clientDashboard.zip",
  "docs": {
    "md": "/path/to/my-app/dist/DEPLOY-README.md",
    "html": "/path/to/my-app/dist/DEPLOY-README.html"
  }
}
```

The command:
1. Checks for `package.json` in the directory
2. Installs dependencies if `node_modules` is missing
3. Runs the best build script in priority order: `dist` > `build:bonita` > `build`
4. Locates the produced ZIP in `dist/` and reports its path

---

## Common workflows

### "Client gives me their existing React app and a Bonita app token"

```bash
cd /path/to/their-app
bonita-page wrap --framework=react --name=ourPageName --app-token=theirAppToken
# Review the printed warnings — apply them manually if needed
npm install
npm run dist
bonita-page validate dist/page-ourPageName.zip
# Hand off the ZIP + DEPLOY-README to the client
```

### "I want a fresh Vue project for a new Bonita app"

```bash
bonita-page scaffold \
    --framework=vue \
    --name=expensesPortal \
    --display-name="Expenses Portal" \
    --app-token=expensesApp \
    --target-dir=./expenses-portal

cd expenses-portal
./build.sh           # install + build + ZIP + docs
```

### "CI pipeline: build and validate every PR"

```yaml
# .github/workflows/ci.yml
- run: npm install
- run: npm run dist
- run: npx bonita-page validate dist/page-*.zip
```

The validate exit code feeds into the CI's pass/fail.

---

## Diagnostic & support

### Verbose output

```bash
BONITA_PAGE_DEBUG=1 bonita-page scaffold ...
```

Adds stack traces on errors.

### Output format

All subcommands print a single JSON object on success (parseable). On error: a human-readable `Error: ...` line and exit code 1 (or 2 for usage errors).

### File hand-off pattern (no Node on client)

If the client doesn't have Node installed, the toolkit owner runs `scaffold` or `wrap` themselves and sends ONLY:

- The generated project (or just the produced `dist/page-*.zip` + `dist/DEPLOY-README.{md,html}`)

`build.sh`/`build.bat` inside the project still need Node to rebuild — but if the client just wants to deploy what you sent, only the ZIP is needed.

---

## Equivalence with MCP tools

When running inside an MCP-enabled agent (Claude with `bonita-ai-agent-mcp`), these tools call the same code:

| MCP tool | CLI equivalent |
|----------|----------------|
| `prepare_custom_page` | `bonita-page prepare ...` |
| `scaffold_custom_page` | `bonita-page scaffold ...` |
| `wrap_existing_app` | `bonita-page wrap ...` |
| `check_custom_page_project` | `bonita-page check [project-dir]` |
| `setup_testing_for_project` | `bonita-page setup-testing [project-dir]` |
| `test_custom_page_project` | `bonita-page test [--coverage] [--e2e]` |
| `implement_demo_for_framework` | `bonita-page implement-demo --framework=... --name=... --app-token=... --spec=<path-to-spec.json>` |
| `validate_custom_page_zip` | `bonita-page validate ...` |
| `build_custom_page` | `bonita-page build ...` |
| `get_deployment_guide` | (no CLI equivalent — read `docs/DEPLOYMENT.md` or `docs/DEPLOY_2025.md`) |
| `list_custom_page_examples` | `ls examples/` |

Both flows call the functions in `scripts/{prepare,scaffold,wrap,check,setup-testing,test,validate,build}.js`. Single source of truth — fixes propagate to both.
