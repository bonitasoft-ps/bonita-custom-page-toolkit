# bonita-custom-page-toolkit

Read **`.sdd/SDD.md`** first — the architectural contract (same-origin model,
the seven non-negotiable rules, testing rules, quality gates).

## Map

- `skills/bonita-custom-page/` — foundational, framework-agnostic. Load before
  any custom-page work; it defines the questions to ask and the seven rules.
- `skills/bonita-{react,vue,angular,svelte,solid,qwik}-app/` — framework skills.
- `skills/bonita-testing/` — testing patterns (MSW browser mode, all 6 frameworks).
- `examples/` — runnable apps: `*-directory-bonita` (one per framework) +
  `react|vue|angular-task-viewer`.
- `bonita-page.sh|.bat` + `docs/CLI.md` — scaffold/wrap without AI.
- `mcp/` — MCP tools for agent-driven generation.
- `docs/` — deployment guides + wrap checklists (EN/ES/FR).

## Rules

- New artifact → `/sdd-init`, fill the matching `spec-front-*` template (from
  the ofelia-claude-code-toolkit plugin) before writing code.
- Follow the seven rules of the foundational skill; CSP nuances are documented
  there (no `frame-ancestors` in meta; Angular needs `script-src 'unsafe-inline'`).
- Test names = business rule; no mocks of code we own (network-edge stubs only).
- Never commit `node_modules/`, `dist/`, built ZIPs, `.env*`, or client data.
- Branch `claude/<type>/<desc>` + PR via gh; never push to `main`.
