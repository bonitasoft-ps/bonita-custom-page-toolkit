# Future MCP tools (designed, not yet wired)

This document is the design buffer for tools the toolkit will expose **via MCP** but does not yet implement. Each entry is a contract — name, intent, input schema, behaviour, expected output — written precisely enough that a future implementation just slots in.

When a tool here is implemented, move its entry into `mcp/spec/tools.json`, add the handler in `mcp/handlers/index.js`, delete the entry from this file, and update `README.md` / `mcp/README.md`.

---

## `implement_demo_for_framework`

**Status**: **shipped** — handler at `mcp/handlers/index.js`, CLI at `bonita-page implement-demo`, full implementation in `scripts/implement-demo/` and `scripts/implement-demo.js`. Vue adapter complete; the other 5 frameworks generate framework-agnostic domain (types + seeds) and emit a `notSupportedMessage` warning until their adapter is added.

Sample spec in `examples/demo-spec-sample.json`. The contract below remains the canonical reference.

**Intent**: generate a complete "directory-bonita" demo for a given framework, ready to `npm install && npm run dist`. Replaces the manual workflow of scaffolding + adding business logic + UI components + tests. The agent describes a domain (e.g. "BPM tasks inbox with KPIs and an action bar"), the tool produces a runnable project with that domain wired in.

**Why this exists**: the toolkit currently has six `examples/{framework}-directory-bonita/` apps that demonstrate the same scenario per framework. Each was hand-built. When a new framework joins (e.g. Lit, Preact, Astro), or a new demo scenario is requested (insurance, invoices, KYC), the cost is "write ~2000 LOC by hand again." This tool turns that into "call the MCP tool, get a working app."

### Input schema

```json
{
  "type": "object",
  "required": ["framework", "name", "appToken", "spec"],
  "properties": {
    "framework": {
      "type": "string",
      "enum": ["react", "vue", "angular", "svelte", "solid", "qwik"]
    },
    "name": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9]*$" },
    "displayName": { "type": "string" },
    "appToken": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9]*$" },
    "pageToken": { "type": "string", "default": "home" },
    "targetDir": { "type": "string" },
    "spec": { "$ref": "#/definitions/DemoSpec" },
    "includeTesting": { "type": "boolean", "default": true }
  },
  "definitions": {
    "DemoSpec": {
      "type": "object",
      "required": ["domain", "entities", "pages"],
      "properties": {
        "domain": {
          "type": "string",
          "description": "Short domain label, e.g. 'insurance-bpm', 'invoice-tracker'."
        },
        "palette": {
          "type": "object",
          "properties": {
            "primary":   { "type": "string", "description": "Hex, e.g. '#1a2e5a'" },
            "secondary": { "type": "string" },
            "accent":    { "type": "string" }
          }
        },
        "entities": {
          "type": "array",
          "description": "Data model. Each entity becomes a TypeScript type + a mock seed array + a Pinia/Zustand/store.",
          "items": {
            "type": "object",
            "required": ["name", "fields"],
            "properties": {
              "name": { "type": "string" },
              "fields": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["name", "type"],
                  "properties": {
                    "name": { "type": "string" },
                    "type": { "type": "string", "enum": ["string","number","boolean","date","enum","object","array"] },
                    "options": { "type": "array", "items": { "type": "string" } },
                    "ref": { "type": "string", "description": "Name of another entity if this is a foreign key." }
                  }
                }
              },
              "seedCount": { "type": "integer", "default": 5 }
            }
          }
        },
        "pages": {
          "type": "array",
          "description": "Each page maps to a route + a top-level component. Pages can share layouts.",
          "items": {
            "type": "object",
            "required": ["name", "path", "kind"],
            "properties": {
              "name": { "type": "string" },
              "path": { "type": "string", "description": "Hash route, e.g. '/ejecutivo'" },
              "kind": {
                "type": "string",
                "enum": ["list-detail", "dashboard", "form-wizard"]
              },
              "primaryEntity": { "type": "string" },
              "filters":  { "type": "array", "items": { "type": "string" } },
              "metrics":  { "type": "array", "items": { "type": "string" } },
              "actions":  { "type": "array", "items": { "type": "string" }, "description": "Buttons like 'tomar', 'cambiar-estado', 'enviar'." }
            }
          }
        },
        "rolesToTitles": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "Optional map of pages to role labels for the top bar."
        }
      }
    }
  }
}
```

### Behaviour

1. **Detect collisions**: if `targetDir` exists, abort with `{ ok: false, reason: 'targetDir exists' }` unless `--force`.
2. **Scaffold the project** using `scaffold(flags)` from `scripts/scaffold.js`.
3. **Generate domain layer**:
   - `src/types/<domain>.ts` — one interface per entity.
   - `src/data/seed.ts` — seed arrays with `seedCount` items per entity, filled with realistic faker-like values for the field types.
   - `src/stores/<entity>.ts` — Pinia/Zustand/Signal store per entity with CRUD + filtering.
4. **Generate pages and layouts**:
   - `src/layouts/AppLayout.{vue,tsx,svelte,…}` — topbar (logo + breadcrumb + user) + sidebar (one entry per page).
   - `src/pages/<page>.<ext>` — one page per `pages[]`, composed from `kind`:
     - `list-detail` → table + filters + detail drawer + actions bar
     - `dashboard` → KPI cards + chart + recent items
     - `form-wizard` → multi-step form
5. **Apply palette** to the project's tokens file (`src/styles/tokens.css`).
6. **Optionally apply testing** if `includeTesting=true` — call `setupTesting(projectDir)` and add 4-6 sample tests against the generated stores.
7. **Wrap + build**: invoke `wrap(flags)` then `build(projectDir)` to produce the ZIP.
8. **Return**:
```json
{
  "ok": true,
  "framework": "vue",
  "projectDir": "…",
  "zipPath": "…/dist/page-<name>.zip",
  "docs": { "md": "…", "html": "…" },
  "filesGenerated": ["…"],
  "nextSteps": ["Upload to Bonita …"]
}
```

### Implementation outline

Single Node module: `scripts/implement-demo.js`.

Key responsibilities and where they live:

| Concern | File | Notes |
|---|---|---|
| Spec validation | `scripts/implement-demo/validate-spec.js` | Reject malformed input early |
| Domain generation | `scripts/implement-demo/generate-domain.js` | Types + seeds + stores |
| Page generation | `scripts/implement-demo/generate-pages.js` | Per `kind` strategy |
| Framework-specific templates | `templates/demo-impl/<framework>/{list-detail,dashboard,form-wizard}.tpl` | One template per (framework × kind) |
| Faker-like seeds | `scripts/implement-demo/seed-values.js` | No dependency — small pure functions per type |
| Palette application | `scripts/implement-demo/apply-palette.js` | Edits tokens.css with regex |

### Non-goals (explicit)

- **Real BPM integration**: the generated stores use mocks. Wiring to `/bonita/API/bpm/...` is a separate concern (skill `bonita-{framework}-app/` covers it).
- **Custom CSS**: palette only. No bespoke layouts beyond the three `kind` templates.
- **Multi-domain composition** in one call: one demo per call. Want two demos? Two calls.

### Why not implement it today

1. The cross-framework patches in `templates/demo-impl/` need 18 template variants (6 frameworks × 3 kinds). That's ~3000 LOC of mostly mechanical work.
2. The "domain → seed values" needs more design — date ranges, dependent fields, FK realism. Doable but non-trivial.
3. Without it, an agent + the existing `scaffold` + `setup-testing` tools + a domain skill can produce the same result in three calls (scaffold → write business code → setup-testing). The MCP tool collapses three calls into one; valuable, but not blocking.

Estimated effort to implement: 1.5–2 days of focused work, assuming the three `kind` templates are agreed up front.

### Test plan once implemented

- Unit-test the spec validator against malformed inputs (missing entities, bad refs).
- Snapshot-test the generated files for one (vue × list-detail) configuration.
- End-to-end: call the tool with the Provincia spec, check the generated project matches `examples/vue-directory-bonita` modulo cosmetic differences.

---

## Other candidate tools (not detailed yet)

- `migrate_legacy_custom_page` — take a Bonita 7.x custom-page ZIP (jQuery / AngularJS) and emit a modern equivalent (React/Vue) skeleton.
- `audit_custom_page_zip` — deeper-than-validate audit: CSP analysis, bundle size warnings, hash-routing check on the deployed HTML.
- `localize_custom_page` — given an existing custom-page project, scan strings and produce `vue-i18n` / `react-intl` / `ngx-translate` locale files.

These are scoped for later iterations. Open a GitHub issue if any becomes urgent.
