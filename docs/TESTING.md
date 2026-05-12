# Testing — the toolkit's standard

This document describes the cross-framework testing standard that `bonita-page setup-testing` applies, what it covers, what it doesn't, and how to operate it locally and in CI.

The full rationale (which tools, why, what trade-offs) lives in [`../skills/bonita-testing/SKILL.md`](../skills/bonita-testing/SKILL.md). This document is the operational reference.

---

## What you get

After `bonita-page setup-testing` runs on a project, you have:

| Tool | What it tests |
|---|---|
| **Vitest** (or Jest for Angular) | Unit + component tests in `src/**/*.test.ts` |
| **Testing Library** | User-centric component assertions |
| **MSW** | Bonita REST API mocks for jsdom + Playwright |
| **Playwright** | End-to-end tests in `tests/e2e/*.spec.ts` |
| **ESLint flat config** | Real errors only (a11y, security); style nits are warnings |
| **Prettier** | One format, no bikeshedding |
| **husky + lint-staged** | Pre-commit gate: lint + format on staged files |
| **v8 coverage** (or Istanbul for Jest) | Per-folder thresholds (see below) |

### Files added

```
project-root/
├── package.json                  # scripts + devDeps + lint-staged
├── vitest.config.ts              # (or jest.config.js for Angular)
├── playwright.config.ts
├── eslint.config.js
├── .prettierrc + .prettierignore
├── src/
│   ├── test-setup.ts             # jest-dom matchers + MSW server lifecycle
│   ├── mocks/handlers.ts         # Bonita REST API mocks
│   ├── mocks/server.ts
│   └── api/__tests__/client.test.ts   # sample smoke test
└── tests/e2e/smoke.spec.ts       # sample E2E
```

Nothing in your existing `src/` is overwritten. Re-running `setup-testing` is idempotent — missing files are added, existing ones are left untouched.

---

## Coverage thresholds (per-folder)

Configured in `vitest.config.ts` (or `jest.config.js`):

```ts
thresholds: {
  'src/api/**':         { lines: 80, functions: 80, branches: 75 },  // BLOCKING
  'src/composables/**': { lines: 80, functions: 80, branches: 75 },  // BLOCKING
  'src/hooks/**':       { lines: 80, functions: 80, branches: 75 },  // BLOCKING (React/Solid)
  'src/stores/**':      { lines: 80, functions: 80, branches: 75 },  // BLOCKING
  // components and pages: recommended but NOT blocking
}
```

**Why per-folder?** A Bonita custom page is mostly UI (components + pages). Forcing 80% coverage on UI wastes time on tests that protect little. The 200-500 LOC of logic (API client, stores, composables) is what causes 3 AM pages in production — that's what we block on.

If you want stricter UI coverage, raise the thresholds in `vitest.config.ts`. The skill documents why we recommend not doing this for typical custom pages.

---

## Running tests

From inside the project:

```bash
npm test                  # unit + component, single pass
npm run test:watch        # interactive
npm run test:coverage     # with thresholds enforced
npm run e2e               # Playwright (auto-starts dev server)
npm run e2e:install       # first-time download of chromium
npm run lint              # ESLint
npm run format            # Prettier write
npm run format:check      # Prettier verify (CI)
```

From the toolkit's CLI (proxies to the project's scripts):

```bash
bonita-page test                       # → npm test
bonita-page test --coverage            # → npm run test:coverage
bonita-page test --e2e                 # → npm run e2e
bonita-page test --project-dir=/path   # specify a different project
```

Same actions are available as MCP tools — `test_custom_page_project` with `{ projectDir, coverage, e2e }`.

---

## Methodology — short version

For every test, follow Arrange–Act–Assert and test the **user-visible outcome**, not internal implementation:

```ts
// ❌ DON'T — internal state
expect(wrapper.vm.counter).toBe(1);

// ✅ DO — observable behaviour
await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
expect(screen.getByText('Total: 1')).toBeInTheDocument();
```

Reason: internal state moves between refactors. The user-visible `Total: 1` is the contract you actually have with your users.

### Where to put logic

Components are dumb. Logic goes in:

- `src/api/` — pure fetch wrappers
- `src/stores/` — Pinia (Vue) / Zustand (React) / Signal stores (Solid) / Svelte stores / Qwik signals at module level
- `src/composables/` (Vue/Svelte/Solid) or `src/hooks/` (React) — reusable hooks

If you find logic in a component, **extract it to a composable / hook / store before writing the test**. Testing through the DOM is slow and brittle.

---

## Per-framework specifics

| Framework | Runner | Component lib | A11y plugin | Notes |
|---|---|---|---|---|
| React | Vitest | `@testing-library/react` | `eslint-plugin-jsx-a11y` | jsdom env |
| Vue | Vitest | `@testing-library/vue` + `@vue/test-utils` | `eslint-plugin-vuejs-accessibility` | jsdom env |
| Svelte 5 | Vitest | `@testing-library/svelte` | `eslint-plugin-svelte` | runes require `mode: 'client'` |
| Solid | Vitest | `@solidjs/testing-library` | `eslint-plugin-solid` | jsdom env |
| Qwik | Vitest | `@builder.io/qwik/testing` | `eslint-plugin-qwik` | SPA-only; `useVisibleTask$` works in tests |
| Angular | Jest | `@testing-library/angular` | `@angular-eslint/eslint-plugin` | Jest-preset-angular wires the transformer |

The `setup-testing` script installs the right plugin per framework. ESLint config is generated to match.

---

## MSW Bonita API mocks

Default `src/mocks/handlers.ts` ships these mocks:

- `GET /bonita/API/system/session/unusedId` → 200 with a fake session
- `GET /bonita/API/bpm/humanTask` → empty array + `Content-Range`
- `POST /bonita/API/bpm/userTask/:id/execution` → 204
- `GET /bonita/API/bpm/process` → empty array + `Content-Range`
- `GET /bonita/API/bpm/case` → empty array + `Content-Range`

For per-test overrides:

```ts
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';

it('handles 5 tasks', async () => {
  server.use(
    http.get('/bonita/API/bpm/humanTask', () =>
      HttpResponse.json(
        [/* 5 tasks */],
        { headers: { 'Content-Range': '0-4/5' } }
      )
    )
  );
  // ... assert
});
```

These mocks mirror the real endpoints the wrapped SPA hits, so a green test gives you a real signal about runtime behaviour.

---

## Pre-commit hook

`husky` + `lint-staged` are installed but **not activated** by default (the repo may not be a git repo yet). After `git init`:

```bash
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

This blocks commits with broken lint or formatting. Tests are NOT run on pre-commit (too slow) — they run in CI.

---

## CI snippet (GitHub Actions)

```yaml
name: ci
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test:coverage
      - run: npm run e2e:install
      - run: npm run e2e
      - run: npm run dist
      - uses: actions/upload-artifact@v4
        with:
          name: bonita-page-zip
          path: dist/page-*.zip
```

The full quality gate is: **lint → format → unit + coverage → E2E → build → artifact**. A failure at any stage blocks merge.

---

## Common questions

- **"My UI coverage is 30% — is that bad?"** No. Coverage thresholds only block on `src/api/`, `src/stores/`, `src/composables/` (or `src/hooks/`). UI coverage is recommended but won't fail the build.
- **"Can I swap Cypress for Playwright?"** Yes, but you own the migration. The toolkit's MSW + lint + coverage configs still apply.
- **"My test fails after a framework version bump."** Fix the test, not the version. If the test asserts internal state, rewrite it user-centric.
- **"Does `setup-testing` overwrite my existing tests?"** No. It only creates files that don't exist. Re-running is safe.
- **"Can I add per-component tests later?"** Yes. Follow the pattern in `src/components/__tests__/` (the toolkit's Vue reference: [`examples/vue-directory-bonita/src/components/__tests__/KpiCards.test.ts`](../examples/vue-directory-bonita/src/components/__tests__/KpiCards.test.ts)).

---

## Related skills and tools

- [`../skills/bonita-testing/SKILL.md`](../skills/bonita-testing/SKILL.md) — full methodology rationale
- [`../skills/bonita-{framework}-app/SKILL.md`](../skills/) — framework-specific scaffolding patterns
- [`WRAP-CHECKLIST.md`](WRAP-CHECKLIST.md) — the seven rules tests must protect (relative base, hash routing, credentials, CSRF, …)
- MCP tools: `setup_testing_for_project`, `test_custom_page_project`
- CLI: `bonita-page setup-testing`, `bonita-page test`
