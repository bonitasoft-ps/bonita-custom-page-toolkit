# SDD — bonita-custom-page-toolkit

> Architectural contract for this toolkit. Claude Code reads this first. It
> points at the living knowledge instead of duplicating it.
>
> - Framework-agnostic rules (questions to ask, architecture, the seven
>   non-negotiable rules, ZIP layout, CSP nuances, version differences):
>   `skills/bonita-custom-page/SKILL.md`
> - Framework skills: `skills/bonita-{react,vue,angular,svelte,solid,qwik}-app/`
> - Testing skill (incl. MSW browser-mode pattern, all 6 frameworks):
>   `skills/bonita-testing/`
> - CLI: `bonita-page scaffold` / `wrap` (`docs/CLI.md`); MCP tools in `mcp/`
> - Deployment: `docs/DEPLOYMENT.md`, `docs/DEPLOY_2025.md`, wrap checklists
> - Spec templates per framework (ofelia-claude-code-toolkit plugin):
>   `spec-front-{react,vue,angular,svelte,qwik,solid}.md`, `spec-uibuilder.md`

## 1. What this toolkit is

The single home for building **Bonita custom pages** as SPAs in six frameworks
(react, vue, angular, svelte, solid, qwik), three ways: CLI (no AI), MCP
(agent-driven), or by reading `skills/` + `examples/`.

`examples/` contains runnable reference apps: one `*-directory-bonita` per
framework, plus `react|vue|angular-task-viewer` (task-list apps absorbed from
the former `ui-bonita-projects` repo).

## 2. Non-negotiable architecture (from the foundational skill)

- Same-origin only: Browser → Bonita Tomcat → custom page ZIP → static SPA. No
  proxy, no frontend server in production.
- The seven rules of `skills/bonita-custom-page` (relative base paths, hash
  routing, relative `/bonita/API` calls, credentials included, CSRF header from
  cookie, exact ZIP layout, strict CSP with its two documented nuances).
- Dev mode against a real Bonita or MSW network stub; stubs never ship.

## 3. Workflow for new artifacts

`/sdd-init` → fill the matching `spec-front-*` template → scaffold with the CLI
or MCP tool → implement following the framework skill → test → package ZIP →
deploy per `docs/DEPLOYMENT.md`.

## 4. Testing rules (ecosystem-wide)

- Test names express the **business rule**, not the implementation.
- **No mocks of code we own**; the Bonita REST API is external — stub at the
  network edge only (MSW / Playwright route interception). See `skills/bonita-testing`.
- Unit: Vitest (+ Testing Library). E2E: Playwright asserting the CSRF header
  on at least one mutation flow.

## 5. Quality gates

ESLint + Prettier clean; Vitest green; Playwright green; ZIP builds and deploys
on a clean Bonita; no secrets/`.env` in the ZIP; client data never enters this
repo (examples are synthetic).
