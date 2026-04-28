# bonita-custom-page-toolkit

Build [Bonita](https://www.bonitasoft.com/) custom pages as **React**, **Vue** or **Angular** SPAs — three ways to use it:

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

### Wrap an EXISTING React/Vue/Angular project

If a client already has an SPA they want to deploy as a Bonita custom page:

```bash
cd /path/to/their-existing-app
/path/to/bonita-custom-page-toolkit/bonita-page.sh wrap \
    --framework=react \
    --name=clientDashboard \
    --display-name="Client Dashboard" \
    --app-token=clientApp \
    --page-token=home

# Wrap adds (without modifying their code):
#   page.properties
#   scripts/package-bonita.js + scripts/copy-docs.js
#   docs/DEPLOY-README.{md,html} (EN/FR/ES)
#   build.sh + build.bat
#   `dist` and `build:bonita` scripts in package.json
# It also CHECKS for the common Bonita pitfalls (base path, hash routing,
# withCredentials) and prints WARNINGS if anything looks wrong.

./build.sh
# → dist/page-clientDashboard.zip
```

### Validate a ZIP before uploading

```bash
./bonita-page.sh validate ./dist/page-myApp.zip
# Returns 0 + JSON report if OK, exits 1 otherwise
```

---

## Quick start (with Claude / MCP)

If your environment has the Bonita-AI-Agent MCP (or any MCP) configured, the toolkit registers six tools:

| Tool | What you'd ask Claude |
|------|----------------------|
| `scaffold_custom_page` | *"Create a Vue custom page named X for app Y"* |
| `wrap_existing_app` | *"Wrap this Angular project as a Bonita custom page"* |
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
├── templates/                   ← Used by scaffold.js
│   ├── react-vite-bonita/           Vite + React + AntD + Zustand + HashRouter
│   ├── vue-vite-bonita/             Vite + Vue 3 + Element Plus + Pinia + WebHashHistory
│   ├── angular-cli-bonita/          Angular 18 standalone + signals + APP_INITIALIZER
│   └── shared-docs/                 Multilingual DEPLOY-README templates (EN/FR/ES)
│
├── skills/                      ← For agentic AI (Claude). Markdown-based knowledge.
│   ├── bonita-custom-page/          Foundational, framework-agnostic
│   ├── bonita-react-app/            React-specific scaffolding rules
│   ├── bonita-vue-app/              Vue-specific
│   └── bonita-angular-app/          Angular-specific (incl. APP_INITIALIZER pattern)
│
├── examples/                    ← Six runnable examples, two patterns × three frameworks
│   ├── react-task-viewer/           Generic task list demo, port :8080
│   ├── vue-task-viewer/
│   ├── angular-task-viewer/
│   ├── react-directory-bonita/      Turnkey deploy to a specific Application
│   ├── vue-directory-bonita/
│   └── angular-directory-bonita/
│
├── docs/                        ← Reference deployment guides
│   ├── DEPLOYMENT.md                Universal (Bonita 7.x friendly)
│   └── DEPLOY_2025.md               Bonita 2025.x (current admin URLs)
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
| `react-task-viewer/` | Generic; pick your own application |
| `react-directory-bonita/` | `/bonita/apps/appDirectoryBonitaReact/home/` |
| `vue-task-viewer/` | Generic |
| `vue-directory-bonita/` | `/bonita/apps/appDirectoryBonitaVue/home/` |
| `angular-task-viewer/` | Generic |
| `angular-directory-bonita/` | `/bonita/apps/appDirectoryBonitaAngular/home/` |

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
