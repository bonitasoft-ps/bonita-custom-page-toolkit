# bonita-custom-page-toolkit

Build [Bonita](https://www.bonitasoft.com/) custom pages as **React**, **Vue**, **Angular**, **Svelte**, **SolidJS** or **Qwik** SPAs — three ways to use it:

| Audience | How |
|---|---|
| **Developer with no AI** | Run `bonita-page scaffold` / `wrap` from a shell — generates a project, packages a ZIP, ships multilingual deploy docs |
| **Developer with Claude / MCP** | Connect this toolkit's MCP tools and ask the agent: *"Create me a React custom page named X for Bonita app Y"* |
| **Reading the source** | Skills in [`skills/`](skills/) (Claude/agent-friendly) and runnable [`examples/`](examples/) you can copy and adapt |

The toolkit produces a Bonita-compatible ZIP (`page.properties` at root + `resources/{index.html,assets/...}`), a multilingual `DEPLOY-README.md` and `.html` next to the ZIP, and `build.sh` / `build.bat` so anyone can rebuild later.

---

## Quick start (no AI)

```bash
# Clone
git clone https://github.com/bonitasoft-ps/bonita-custom-page-toolkit.git
cd bonita-custom-page-toolkit
```

### Scaffold a brand-new project

```bash
./bonita-page.sh scaffold \
    --framework=react \
    --name=invoiceDashboard \
    --display-name="Invoice Dashboard" \
    --app-token=invoiceApp \
    --page-token=home \
    --target-dir=../invoice-dashboard

cd ../invoice-dashboard
./build.sh
# → dist/page-invoiceDashboard.zip + DEPLOY-README.{md,html}
```

(On Windows: use `bonita-page.bat` and `build.bat`.)

### Wrap an EXISTING SPA project (any of the 6 frameworks)

If a client already has a React/Vue/Angular/Svelte/Solid/Qwik app and wants to deploy it as a Bonita custom page, you can wrap it WITHOUT touching their `src/` code.

**One command (happy path)** — chains check → wrap → npm install → build, aborts on the first failure:

```bash
cd /path/to/their-existing-app
/path/to/bonita-custom-page-toolkit/bonita-page.sh prepare \
    --name=clientDashboard \
    --display-name="Client Dashboard" \
    --app-token=clientApp
# → dist/page-clientDashboard.zip + DEPLOY-README.{md,html}
```

If `prepare` aborts in the `check` stage, it lists exactly what to fix per [`docs/WRAP-CHECKLIST.md`](docs/WRAP-CHECKLIST.md) (also available in [Castellano](docs/WRAP-CHECKLIST.es.md) and [Français](docs/WRAP-CHECKLIST.fr.md)). Fix the issues in `src/` and re-run.

**Step by step (more control)**:

```bash
cd /path/to/their-existing-app

# 1. Pre-flight check (read-only). Lists any of the 7 rules they're missing.
/path/to/bonita-custom-page-toolkit/bonita-page.sh check

# 2. If check passes, wrap it (adds page.properties, packaging, build scripts, deploy docs)
/path/to/bonita-custom-page-toolkit/bonita-page.sh wrap \
    --name=clientDashboard \
    --display-name="Client Dashboard" \
    --app-token=clientApp

# 3. Build the ZIP
./build.sh
# → dist/page-clientDashboard.zip + DEPLOY-README.{md,html}
```

`wrap` adds these files at the project root WITHOUT touching `src/`:
- `page.properties` (Bonita page descriptor)
- `scripts/package-bonita.js` + `scripts/copy-docs.js`
- `docs/DEPLOY-README.{md,html}` (multilingual EN/FR/ES)
- `build.sh` + `build.bat`
- `dist` + `build:bonita` scripts in `package.json`
- `archiver` (and `cross-env` for Angular) in `devDependencies`

### Validate a ZIP before uploading

```bash
./bonita-page.sh validate ./dist/page-myApp.zip
# Returns 0 + JSON report if OK, exits 1 otherwise
```

### Add the testing standard to any project

```bash
cd /path/to/their-existing-app
/path/to/bonita-custom-page-toolkit/bonita-page.sh setup-testing
# Adds Vitest (or Jest for Angular) + Testing Library + Playwright + MSW
# + ESLint + Prettier + husky + lint-staged, with per-folder coverage
# thresholds (80% blocking on src/api, src/stores, src/composables, src/hooks).

npm install
npm run test:coverage    # → blocks if logic falls under 80%
npm run e2e              # → Playwright smoke
```

Full reference in [`docs/TESTING.md`](docs/TESTING.md) and the methodology rationale in [`skills/bonita-testing/SKILL.md`](skills/bonita-testing/SKILL.md).

---

## Quick start (with Claude / MCP)

If your environment has the Bonita-AI-Agent MCP (or any MCP) configured, the toolkit registers these tools:

| Tool | What you'd ask Claude |
|------|----------------------|
| `prepare_custom_page` | *"Wrap and build this project in one shot for Bonita app Y"* (happy path: check + wrap + install + dist) |
| `scaffold_custom_page` | *"Create a Vue custom page named X for app Y"* |
| `wrap_existing_app` | *"Wrap this Angular project as a Bonita custom page"* |
| `check_custom_page_project` | *"Is this project ready to wrap?"* |
| `setup_testing_for_project` | *"Add the toolkit's testing standard (Vitest + Playwright + MSW + ESLint…) to this project"* |
| `test_custom_page_project` | *"Run the test suite — with coverage"* |
| `implement_demo_for_framework` | *"From this DemoSpec, generate a full Vue/React/… custom page (scaffold + types + seeds + stores + pages + tests + ZIP)"* |
| `validate_custom_page_zip` | *"Check this ZIP is Bonita-compatible"* |
| `build_custom_page` | *"Build the project at this path"* |
| `get_deployment_guide` | *"How do I deploy to Bonita 2025.x?"* |
| `list_custom_page_examples` | *"What examples ship with the toolkit?"* |

Registration instructions and the tool spec are in [`mcp/`](mcp/).

---

## Architecture

```
bonita-custom-page-toolkit/
│
├── bonita-page.sh / .bat        ← Standalone CLI (no IA needed)
├── package.json                 ← Exposes `bonita-page` as `bin`
│
├── scripts/                     ← Single source of truth — both CLI and MCP call these
│   ├── cli.js                       Subcommand dispatcher
│   ├── scaffold.js                  Create new project from template
│   ├── wrap.js                      Add Bonita layer to existing project
│   ├── validate.js                  Verify ZIP layout
│   └── build.js                     Run install + build:bonita
│
├── templates/                   ← Used by scaffold.js (6 frameworks)
│   ├── react-vite-bonita/           Vite + React + AntD + Zustand + HashRouter
│   ├── vue-vite-bonita/             Vite + Vue 3 + Element Plus + Pinia + WebHashHistory
│   ├── angular-cli-bonita/          Angular 18 standalone + signals + APP_INITIALIZER
│   ├── svelte-vite-bonita/          Svelte 5 (runes) + svelte-spa-router (hash)
│   ├── solid-vite-bonita/           SolidJS + @solidjs/router (hash)
│   ├── qwik-vite-bonita/            Qwik in SPA-only mode (no Qwik City)
│   └── shared-docs/                 Multilingual DEPLOY-README templates (EN/FR/ES)
│
├── skills/                      ← For agentic AI (Claude). Markdown-based knowledge.
│   ├── bonita-custom-page/          Foundational, framework-agnostic + Questions to ask
│   ├── bonita-react-app/            React-specific scaffolding rules
│   ├── bonita-vue-app/              Vue-specific
│   ├── bonita-angular-app/          Angular-specific (incl. APP_INITIALIZER pattern)
│   ├── bonita-svelte-app/           Svelte 5 (runes, .svelte.ts stores)
│   ├── bonita-solid-app/            SolidJS (createStore, all-CSS-in-app.css rule)
│   └── bonita-qwik-app/             Qwik SPA mode (useVisibleTask$, module-level helpers)
│
├── examples/                    ← Six runnable demo apps — one per framework
│   ├── react-directory-bonita/      Turnkey deploy to a specific Application
│   ├── vue-directory-bonita/
│   ├── angular-directory-bonita/
│   ├── svelte-directory-bonita/     Svelte 5 — smallest of the bunch (~22 KB ZIP)
│   ├── solid-directory-bonita/      SolidJS — tiniest framework runtime (~14 KB gzip)
│   └── qwik-directory-bonita/       Qwik (SPA mode) — auto-split into 9 lazy chunks
│
├── docs/                        ← Reference docs
│   ├── DEPLOYMENT.md                Deployment — universal (Bonita 7.x friendly)
│   ├── DEPLOY_2025.md               Deployment — Bonita 2025.x (current admin URLs)
│   ├── CLI.md                       `bonita-page` CLI reference (scaffold/wrap/check/validate/build)
│   └── WRAP-CHECKLIST.md            Pre-flight checklist for wrapping an existing SPA (no AI needed)
│
└── mcp/                         ← MCP integration
    ├── spec/tools.json              Tool definitions (JSON Schema)
    ├── handlers/index.js            Glue from MCP tool calls to scripts/
    └── README.md                    Registration instructions
```

The CLI and the MCP handlers both call the **same functions** in `scripts/`. One source of truth — fixes propagate to both.

---

## What gets generated

Whether scaffolding or wrapping, the resulting project has:

```
my-page/
├── page.properties              ← Bonita page descriptor
├── docs/
│   ├── DEPLOY-README.md         ← Step-by-step deploy guide (EN/FR/ES)
│   └── DEPLOY-README.html
├── scripts/
│   ├── package-bonita.js        ← Builds the ZIP
│   └── copy-docs.js             ← Copies docs to dist/
├── build.sh / build.bat         ← One-command install + build + dist
├── src/                         ← Your SPA source
├── package.json                 ← `dist` + `build:bonita` scripts wired
└── (vite.config.ts | angular.json | proxy.conf.json)
```

After `./build.sh` (or `npm run dist`), the resulting `dist/` contains:

```
dist/
├── page-<name>.zip              ← Upload THIS to Bonita
├── DEPLOY-README.md             ← Hand to whoever installs it (EN/FR/ES)
└── DEPLOY-README.html           ← Same content, browseable
```

---

## Six runnable example apps

The toolkit ships **6 fully-working dashboard apps** — same scenario (login + Bonita session probe + KPI cards + priority chart + tabs for tasks/cases/processes + detail modal), one per framework. All deployable to Bonita 2025.x as-is — just `cd`, `./build.sh`, and upload the produced ZIP.

| Example | Framework | URL it deploys to | Bundle (gzip) |
|---------|-----------|-------------------|---------------|
| [`examples/react-directory-bonita/`](examples/react-directory-bonita/) | React 19 + AntD | `/bonita/apps/appDirectoryBonitaReact/home/` | ~349 KB |
| [`examples/vue-directory-bonita/`](examples/vue-directory-bonita/) | Vue 3 + Element Plus | `/bonita/apps/appDirectoryBonitaVue/home/` | ~330 KB |
| [`examples/angular-directory-bonita/`](examples/angular-directory-bonita/) | Angular 18 standalone + signals | `/bonita/apps/appDirectoryBonitaAngular/home/` | ~175 KB |
| [`examples/svelte-directory-bonita/`](examples/svelte-directory-bonita/) | Svelte 5 (runes) | `/bonita/apps/appDirectoryBonitaSvelte/home/` | **~20 KB** |
| [`examples/solid-directory-bonita/`](examples/solid-directory-bonita/) | SolidJS | `/bonita/apps/appDirectoryBonitaSolid/home/` | **~14 KB** |
| [`examples/qwik-directory-bonita/`](examples/qwik-directory-bonita/) | Qwik (SPA mode) | `/bonita/apps/appDirectoryBonitaQwik/home/` | ~25 KB |

To get one running:

```bash
cd examples/svelte-directory-bonita        # or any of the six
./build.sh                                  # → dist/page-*.zip + multilingual deploy docs
# Upload the ZIP per docs/DEPLOY_2025.md
```

---

## Choosing a framework — measured comparison

The toolkit ships the **same scenario** built in six frameworks. Real measurements (gzipped JS, ZIP size, source LOC, file count) and an opinionated guide on **when to pick each one** are in:

| File | Audience |
|------|----------|
| [`COMPARISON.md`](COMPARISON.md) | Developers reading the source — markdown, trilingual EN/FR/ES |
| [`COMPARISON.html`](COMPARISON.html) | Anyone reading in a browser — standalone HTML with language switcher |

TL;DR from the data:

- **Smallest bundle**: SolidJS (14 KB gzip) → Svelte 5 (20 KB) → Qwik (25 KB).
- **Largest bundle**: React + AntD (349 KB gzip), Vue + Element Plus (330 KB) — the UI library accounts for most of it.
- **Best balance for new Bonita pages without legacy**: Svelte 5.
- **Stick with what you know** if the team already uses React / Vue / Angular — the 175–350 KB gzip is fine for an internal Bonita app.

Full decision tree, maintenance/longevity matrix, and notes on Astro/Lit/Preact/Alpine.js/HTMX/Mithril are in the comparison docs.

## Bonita compatibility

| Bonita version | Support |
|---|---|
| 2025.x (year-numbered, current) | **Primary target.** Admin URLs (`superAdminAppBonita` / `adminAppEEBonita`), `Layout Without Menu`, strict `o=` parser — all reflected in scaffolding and docs |
| 2024.x | Same as 2025.x |
| 7.x and earlier | Legacy Portal UI (`/bonita/portal/admin`) — see `docs/DEPLOYMENT.md` |

The seven non-negotiable rules (relative base path, hash routing, `credentials: 'include'`, CSRF, ZIP layout, CSP, no SSR) are documented in [`skills/bonita-custom-page/SKILL.md`](skills/bonita-custom-page/SKILL.md) and applied by all templates.

---

## Examples

Six runnable examples are bundled. Each can be opened independently:

```bash
cd examples/react-directory-bonita
./build.sh                    # → dist/page-appDirectoryBonitaReactHome.zip
```

| Example | URL it deploys to |
|---|---|
| `react-directory-bonita/`   | `/bonita/apps/appDirectoryBonitaReact/home/` |
| `vue-directory-bonita/`     | `/bonita/apps/appDirectoryBonitaVue/home/` |
| `angular-directory-bonita/` | `/bonita/apps/appDirectoryBonitaAngular/home/` |
| `svelte-directory-bonita/`  | `/bonita/apps/appDirectoryBonitaSvelte/home/` |
| `solid-directory-bonita/`   | `/bonita/apps/appDirectoryBonitaSolid/home/` |
| `qwik-directory-bonita/`    | `/bonita/apps/appDirectoryBonitaQwik/home/` |

---

## Troubleshooting

| Symptom | Where to look |
|---|---|
| Build OK but ZIP rejected by Bonita | Run `bonita-page validate dist/page-*.zip` first |
| App loads but wrapped in admin chrome (header + side menu) | Application's Layout — pick **Layout Without Menu** in the Application settings |
| User auto-redirects to `/login` despite Bonita session (Angular) | Confirm `APP_INITIALIZER` is wired in `app.config.ts` (see `skills/bonita-angular-app/references/auth.md`) |
| HTTP 500 on multi-criterion `o=` query | Bonita 2025.x rejects comma-separated. Use `URLSearchParams.append('o', ...)` per criterion |
| Page imports but `/bonita/apps/{app}/{page}/` 404s | Application's Pages tab missing the binding, or token typo |

For full deployment troubleshooting see [`docs/DEPLOY_2025.md`](docs/DEPLOY_2025.md).

---

## Contributing

This is an open-source toolkit maintained by **Bonitasoft Professional Services**. Issues and PRs welcome.

When changing CLI behaviour, the MCP tools inherit it automatically (both call the same `scripts/`). Keep that single source of truth.

## License

Apache-2.0
