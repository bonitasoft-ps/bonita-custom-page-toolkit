---
name: bonita-testing
description: Use when the user wants to add or strengthen tests in a Bonita custom-page project (React, Vue, Angular, Svelte, Solid or Qwik). Defines the cross-framework testing standard the toolkit applies: Vitest + Testing Library (Jest for Angular) for unit and component, Playwright for E2E, MSW for Bonita REST API mocks, ESLint security + a11y, Prettier, husky + lint-staged. Documents the recommended coverage thresholds (80% for src/api, src/stores, src/composables — UI is recommended, not blocking) and how to run them locally and in CI.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
argument-hint: "<setup|review|run> [project-dir]"
---

# Bonita custom-page — testing standard

This skill is the **single source of truth** for how the toolkit tests projects. Whether the project was scaffolded by `bonita-page scaffold`, wrapped from a client SPA by `bonita-page wrap`, or hand-written, the same standard applies.

**Read first**: `../bonita-custom-page/SKILL.md` and `../../docs/WRAP-CHECKLIST.md` for the deployment rules tests must protect.

## TL;DR

| Layer | Tool | Why this one |
|---|---|---|
| Unit + component (5 of 6 frameworks) | **Vitest + Testing Library** | Same DX cross-framework; Vite-native; resumable |
| Unit + component (Angular) | **Jest + @testing-library/angular** | Angular tooling assumes Jest in modern setups |
| E2E (all 6 frameworks) | **Playwright** | Iframe + redirect handling beat Cypress for Bonita |
| API mock | **MSW** | Network-level interception, same handlers in jsdom + Playwright |
| Lint | **ESLint flat config** + `eslint-plugin-security` + accessibility plugin per framework | Real errors only (a11y, security); style nits are warnings |
| Format | **Prettier** | One opinion, no team bikeshedding |
| Pre-commit | **husky + lint-staged** | Block git push when lint/tests fail |
| Coverage | **v8 (Vitest native)** or **Istanbul (Jest)** | Native, no extra deps |

## Recommended coverage thresholds

Per-folder, not global:

```
src/api/**         → lines 80, functions 80, branches 75   (BLOCKING in CI)
src/stores/**      → lines 80, functions 80, branches 75   (BLOCKING in CI)
src/composables/** → lines 80, functions 80, branches 75   (BLOCKING in CI)
src/components/**  → recommended ≥ 60, NOT blocking
src/pages/**       → recommended ≥ 40, NOT blocking
```

**Rationale**: a Bonita custom-page typically has 200-500 LOC of "logic" (API client, stores, composables) and 1500+ LOC of components/pages. The logic is what wakes you up at 3 AM if it breaks. Components are cheap to re-render and refactor. Don't block CI on 100% UI coverage — block on logic.

## Architecture: testable from day one

Every project the toolkit generates puts logic OUT of components:

```
src/
├── api/          Pure functions that wrap fetch (testable with MSW)
├── stores/       Pinia / Zustand / NgRx / Signals — pure state machines
├── composables/  Reusable hooks — independent from any single component
├── components/   Dumb UI — props in, events out
└── pages/        Composition; very little logic
```

If you find logic in a component, **extract it into a composable before writing the test** — testing through DOM is slow and brittle.

## Methodology: AAA + user-centric

For every test:

1. **Arrange** — set up state / mocks
2. **Act** — call the function or fire a user event
3. **Assert** — verify the observable outcome

**For component tests**, test what the user sees and does, NOT what the component holds internally:

```ts
// ❌ DON'T — tests implementation
expect(component.vm.internalCounter).toBe(1);

// ✅ DO — tests user-visible result
await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
expect(screen.getByText('Total: 1')).toBeInTheDocument();
```

This survives refactors. The internal counter may move to a store next month; the user-visible "Total: 1" won't.

## What a "complete" test setup looks like

The toolkit's reference is `examples/vue-directory-bonita/` once `bonita-page setup-testing` has been run. Expect:

```
project-root/
├── package.json                  ← test, test:watch, test:coverage, e2e, lint, format
├── vitest.config.ts              ← jsdom, setup file, coverage thresholds per folder
├── playwright.config.ts          ← chromium project, webServer wiring
├── eslint.config.js              ← flat config with framework-appropriate plugin
├── .prettierrc + .prettierignore
├── src/
│   ├── test-setup.ts             ← jest-dom matchers + MSW server lifecycle
│   ├── mocks/{handlers,server}.ts ← MSW Bonita API handlers (reusable)
│   ├── api/__tests__/*.test.ts   ← driven via MSW
│   ├── stores/__tests__/*.test.ts
│   ├── composables/__tests__/*.test.ts
│   └── components/__tests__/*.test.ts
└── tests/e2e/
    └── *.spec.ts                 ← Playwright smoke (under 10 tests is fine)
```

## MSW browser mode — OPTIONAL but if added, MUST be production-safe

By default `setup-testing` only installs MSW in **Node mode** (for Vitest/Jest). Some projects also want MSW in **browser mode** so that `npm run dev` works without a real Bonita server (great for demos, parallel-dev with backend, stakeholder reviews).

**If you add browser mode, the following safety pattern is mandatory.** Without it, MSW will run in production and silently intercept real Bonita calls.

### The pattern (abstract)

Four mandatory layers, identical across frameworks. Only the **syntax** of layers 1, 2 and 3 differs because the env-var system is framework-specific. Layers 4 and 5 are always the same.

| # | Layer | Catches |
|---|---|---|
| 1 | "Are we in dev?" guard | The agent forgets the env file but uses `npm run build` |
| 2 | "Is the user opting in?" env flag | Mocks would interfere with a dev session pointing at a real Bonita |
| 3 | Dynamic import of `mocks/browser` | Bundle bloat — MSW gets tree-shaken (~150 KB saved in prod) |
| 4 | `.env.production` / equivalent forces flag OFF | Defence in depth — second-line trap |
| 5 | Exclude `mockServiceWorker.js` from production ZIP | The SW file is in `public/` and gets copied to `dist/` — packaging step must trim it |

### Common to all six frameworks

```bash
# One-time: install MSW worker and create the browser-mode entry point.
npx msw init public/ --save
```

`src/mocks/browser.ts` (same code for every framework):

```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export const worker = setupWorker(...handlers);
```

`scripts/package-bonita.js` — always add:

```js
const EXCLUDED_FROM_ARCHIVE = new Set(['mockServiceWorker.js']);
// inside addDirToArchive:
if (EXCLUDED_FROM_ARCHIVE.has(entry)) continue;
```

### Per-framework variants — layers 1, 2, 3

The "dev?" check, the env-var system and the entry-point file differ. **Vite-based frameworks** (React, Vue, Svelte, Solid, Qwik) all share the same syntax. **Angular** is different because it doesn't use Vite — it uses `@angular/build` with esbuild, where env injection works via `src/environments/` and the `fileReplacements` config.

| Framework | Entry file | Layer 1 (dev?) | Layer 2 (opt-in) | Env files |
|---|---|---|---|---|
| Vue | `src/main.ts` | `import.meta.env.DEV` | `import.meta.env.VITE_USE_MOCKS === 'true'` | `.env.development`, `.env.production` |
| React | `src/main.tsx` | `import.meta.env.DEV` | `import.meta.env.VITE_USE_MOCKS === 'true'` | `.env.development`, `.env.production` |
| Svelte | `src/main.ts` | `import.meta.env.DEV` | `import.meta.env.VITE_USE_MOCKS === 'true'` | `.env.development`, `.env.production` |
| Solid | `src/index.tsx` | `import.meta.env.DEV` | `import.meta.env.VITE_USE_MOCKS === 'true'` | `.env.development`, `.env.production` |
| Qwik | `src/entry.tsx` | `import.meta.env.DEV` | `import.meta.env.VITE_USE_MOCKS === 'true'` | `.env.development`, `.env.production` |
| Angular | `src/main.ts` | `!environment.production` | `environment.useMocks === true` | `src/environments/environment.ts` + `environment.prod.ts` (swapped by `fileReplacements`) |

#### Vue (`src/main.ts`)

```ts
async function startMocks() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

async function bootstrap() {
  await startMocks();
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.use(ElementPlus);
  app.mount('#app');
}
bootstrap();
```

#### React (`src/main.tsx`)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

async function startMocks() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

void startMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode><RouterProvider router={router} /></StrictMode>,
  );
});
```

#### Svelte 5 (`src/main.ts`)

```ts
import { mount } from 'svelte';
import App from './App.svelte';

async function startMocks() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

await startMocks();
mount(App, { target: document.getElementById('app')! });
```

#### Solid (`src/index.tsx`)

```tsx
import { render } from 'solid-js/web';
import App from './App';

async function startMocks() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

void startMocks().then(() => {
  render(() => <App />, document.getElementById('root')!);
});
```

#### Qwik (`src/entry.tsx`, SPA-only mode)

```tsx
import { render } from '@builder.io/qwik';
import Root from './root';

async function startMocks() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

void startMocks().then(() => {
  render(document.getElementById('app')!, <Root />);
});
```

#### Angular (different — not Vite)

Angular uses `@angular/build` (esbuild under the hood), not Vite. `import.meta.env.DEV` and `VITE_*` don't exist. Use Angular's standard env mechanism instead.

`src/environments/environment.ts` (default = development):

```ts
export const environment = {
  production: false,
  useMocks: true,
};
```

`src/environments/environment.prod.ts`:

```ts
export const environment = {
  production: true,
  useMocks: false,
};
```

`angular.json` → `architect.build.configurations.production.fileReplacements` (the Angular CLI scaffold already wires this on `ng build`):

```json
"fileReplacements": [{
  "replace": "src/environments/environment.ts",
  "with": "src/environments/environment.prod.ts"
}]
```

`src/main.ts`:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

async function startMocks() {
  if (environment.production) return;
  if (!environment.useMocks) return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

await startMocks();
bootstrapApplication(AppComponent, appConfig).catch(console.error);
```

The dynamic `import()` still gives tree-shaking with esbuild. The `fileReplacements` mechanism is Angular's equivalent of "`.env.production` forces the flag off" — it's stronger because the production code literally swaps in `environment.prod.ts`, so even if someone hand-edits the dev file with `useMocks: true`, prod is unaffected.

### What about "we want to mix mocks + real Bonita"?

Use `onUnhandledRequest: 'bypass'` (default in the pattern above) and **delete handlers** from `src/mocks/handlers.ts` as their real counterparts come online in Bonita:

```
Day 1: handlers.ts contains [session, user, processes, tasks]  → all mocked
Day 5: process endpoints deployed in Bonita → remove process handler from handlers.ts
        → from now on, GET /bonita/API/bpm/process hits the real server
        → tasks remain mocked until they're ready too
```

The unit tests keep using the same `handlers.ts`, so removing a handler is a single edit that propagates everywhere.

### Documentation that MUST go in the project

When you add MSW browser mode to a project, also create `docs/MSW.md` inside the project (not in the toolkit) with: (a) how to toggle `VITE_USE_MOCKS`, (b) what's mocked today, (c) how to remove MSW completely when no longer needed. The Provincia Seguros project ships a reference example: see its `docs/MSW.md`.

---

## MSW Bonita API handlers — reusable across frameworks

Provide these as the default `handlers.ts`. Tests can override per-test with `server.use(...)`:

- `GET /bonita/API/system/session/unusedId` → `{ user_id, user_name, session_id, conf }`
- `GET /bonita/API/bpm/humanTask` → array + `Content-Range`
- `POST /bonita/API/bpm/userTask/:id/execution` → 204
- `GET /bonita/API/bpm/process` → array + `Content-Range`
- `GET /bonita/API/bpm/case` → empty array + `Content-Range`

These match what the wrapped SPA actually calls in production, so a test that uses these handlers gives a real signal about what happens after deployment.

## Activation flow (when this skill is invoked)

1. **Detect framework** from `package.json` / `angular.json`.
2. **Detect existing testing** — abort or merge if Vitest/Jest/Playwright is already configured.
3. **Apply the framework-specific patch** (deps, configs, test-setup, mocks, 4 sample tests, 1 E2E smoke).
4. **Run** `npm install && npm test` to verify a green baseline.
5. **Report**: number of tests, coverage hit, any thresholds missed.

Steps 1-3 are what `scripts/setup-testing.js` does (and what the MCP tool `setup_testing_for_project` wraps).

## Per-framework variants

| Framework | Test runner | Component lib | A11y plugin | Notes |
|---|---|---|---|---|
| React | Vitest | `@testing-library/react` | `eslint-plugin-jsx-a11y` | jsdom env |
| Vue | Vitest | `@testing-library/vue` + `@vue/test-utils` | `eslint-plugin-vuejs-accessibility` | jsdom env |
| Svelte 5 | Vitest | `@testing-library/svelte` | `eslint-plugin-svelte` | runes require `mode: 'client'` |
| Solid | Vitest | `@solidjs/testing-library` | `eslint-plugin-solid` | env: jsdom |
| Qwik | Vitest | `@builder.io/qwik/testing` | (manual) | SPA-only; useVisibleTask$ runs in tests |
| Angular | Jest | `@testing-library/angular` | `@angular-eslint/eslint-plugin` | Jest pre-configured for Angular |

## What to do when …

- **The user asks "is this enough testing?"** → check the blocking thresholds (api/stores/composables ≥ 80%/75% lines/branches). If yes, ship. If no, point at the uncovered branches; they're 90% of real bugs.
- **The user wants 100% UI coverage** → ask why. Usually a misunderstanding of what coverage protects. Refer them to "Recommended coverage thresholds" above.
- **The user wants Cypress instead of Playwright** → fine, but they own the migration. The toolkit's MSW + lint + coverage configs still apply.
- **A test fails on a framework version bump** → fix the test, not the version. If the test was testing internal state, rewrite it to user-centric assertions.

## Running tests

```bash
npm test               # unit + component, single pass
npm run test:watch     # interactive
npm run test:coverage  # with thresholds enforced
npm run e2e            # Playwright (starts dev server if needed)
npm run lint           # ESLint
npm run format         # Prettier write
```

These same scripts are wired into the `bonita-page test` CLI subcommand and the `test_custom_page_project` MCP tool — call those when running from a parent script.

## Pre-commit hook

`husky` + `lint-staged` are installed by `setup-testing` but **not activated** by default (the repo may not be a git repo yet). After `git init`:

```bash
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

This blocks commits with broken lint or formatting. Tests are NOT run on pre-commit (too slow); they run in CI.

## CI snippet (GitHub Actions)

```yaml
- run: npm ci
- run: npm run lint
- run: npm run test:coverage    # blocks on logic thresholds
- run: npm run e2e:install      # downloads chromium
- run: npm run e2e
- run: npm run dist             # build + ZIP
- uses: actions/upload-artifact@v4
  with:
    name: bonita-page-zip
    path: dist/page-*.zip
```

That's the full quality gate: lint → unit + coverage → E2E → build → artifact.
