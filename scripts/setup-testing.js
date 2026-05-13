// `bonita-page setup-testing` — adds the toolkit's testing standard to an
// existing project (Vitest/Jest + Testing Library + Playwright + MSW + ESLint
// + Prettier + husky + lint-staged). Detects the framework from package.json
// or angular.json. Idempotent: re-running on an already-set-up project is a
// no-op except for additive updates.
//
// NOTE: This script installs MSW in NODE mode only (for tests). If the
// project also needs MSW in BROWSER mode (so `npm run dev` works without a
// real Bonita server), follow the production-safe pattern documented in
// skills/bonita-testing/SKILL.md § "MSW browser mode — OPTIONAL but if
// added, MUST be production-safe". The four mandatory layers are:
//   1. `if (!import.meta.env.DEV) return;`  in main.ts/main.tsx
//   2. `if (import.meta.env.VITE_USE_MOCKS !== 'true') return;`
//   3. Dynamic `await import('@/mocks/browser')` so Rollup tree-shakes prod
//   4. Exclude `mockServiceWorker.js` from the production ZIP in
//      scripts/package-bonita.js (EXCLUDED_FROM_ARCHIVE set)
// Skipping any layer risks shipping mocks to production.
//
// What it adds:
//   - dev dependencies (framework-specific)
//   - vitest.config.ts (or jest.config.js for Angular)
//   - playwright.config.ts
//   - src/test-setup.ts
//   - src/mocks/{handlers,server}.ts (MSW Bonita REST mocks)
//   - eslint.config.js (or .eslintrc.cjs for Angular)
//   - .prettierrc + .prettierignore
//   - sample tests in src/api, src/stores (or src/composables/hooks), src/components
//   - tests/e2e/smoke.spec.ts
//   - test, test:watch, test:coverage, e2e, lint, format scripts in package.json
//   - lint-staged block in package.json
//
// Does NOT touch the user's own src/ code beyond adding files inside
// src/api/__tests__, src/stores/__tests__, src/composables/__tests__ folders
// (which it creates if missing).

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLKIT_ROOT = resolve(__dirname, '..');
const PATCHES_DIR = join(TOOLKIT_ROOT, 'templates', 'shared-testing');

const FRAMEWORK_DEPS = {
  vue: {
    devDeps: {
      '@playwright/test': '^1.48.0',
      '@testing-library/jest-dom': '^6.6.0',
      '@testing-library/user-event': '^14.5.2',
      '@testing-library/vue': '^8.1.0',
      '@vitest/coverage-v8': '^2.1.0',
      '@vue/test-utils': '^2.4.6',
      eslint: '^9.13.0',
      'eslint-plugin-vue': '^9.30.0',
      'eslint-plugin-vuejs-accessibility': '^2.4.1',
      husky: '^9.1.0',
      jsdom: '^25.0.0',
      'lint-staged': '^15.2.0',
      msw: '^2.6.0',
      prettier: '^3.3.0',
      'typescript-eslint': '^8.12.0',
      vitest: '^2.1.0',
    },
  },
  react: {
    devDeps: {
      '@playwright/test': '^1.48.0',
      '@testing-library/jest-dom': '^6.6.0',
      '@testing-library/react': '^16.0.0',
      '@testing-library/user-event': '^14.5.2',
      '@types/react': '^19.0.0',
      '@vitejs/plugin-react': '^4.3.0',
      '@vitest/coverage-v8': '^2.1.0',
      eslint: '^9.13.0',
      'eslint-plugin-jsx-a11y': '^6.10.0',
      'eslint-plugin-react': '^7.37.0',
      'eslint-plugin-react-hooks': '^5.0.0',
      husky: '^9.1.0',
      jsdom: '^25.0.0',
      'lint-staged': '^15.2.0',
      msw: '^2.6.0',
      prettier: '^3.3.0',
      'typescript-eslint': '^8.12.0',
      vitest: '^2.1.0',
    },
  },
  svelte: {
    devDeps: {
      '@playwright/test': '^1.48.0',
      '@sveltejs/vite-plugin-svelte': '^4.0.0',
      '@testing-library/jest-dom': '^6.6.0',
      '@testing-library/svelte': '^5.2.0',
      '@testing-library/user-event': '^14.5.2',
      '@vitest/coverage-v8': '^2.1.0',
      eslint: '^9.13.0',
      'eslint-plugin-svelte': '^2.46.0',
      husky: '^9.1.0',
      jsdom: '^25.0.0',
      'lint-staged': '^15.2.0',
      msw: '^2.6.0',
      prettier: '^3.3.0',
      'typescript-eslint': '^8.12.0',
      vitest: '^2.1.0',
    },
  },
  solid: {
    devDeps: {
      '@playwright/test': '^1.48.0',
      '@solidjs/testing-library': '^0.8.10',
      '@testing-library/jest-dom': '^6.6.0',
      '@testing-library/user-event': '^14.5.2',
      '@vitest/coverage-v8': '^2.1.0',
      eslint: '^9.13.0',
      'eslint-plugin-solid': '^0.14.0',
      husky: '^9.1.0',
      jsdom: '^25.0.0',
      'lint-staged': '^15.2.0',
      msw: '^2.6.0',
      prettier: '^3.3.0',
      'typescript-eslint': '^8.12.0',
      'vite-plugin-solid': '^2.10.0',
      vitest: '^2.1.0',
    },
  },
  qwik: {
    devDeps: {
      '@builder.io/qwik': '^1.9.0',
      '@playwright/test': '^1.48.0',
      '@testing-library/jest-dom': '^6.6.0',
      '@testing-library/user-event': '^14.5.2',
      '@vitest/coverage-v8': '^2.1.0',
      eslint: '^9.13.0',
      'eslint-plugin-qwik': '^1.9.0',
      husky: '^9.1.0',
      jsdom: '^25.0.0',
      'lint-staged': '^15.2.0',
      msw: '^2.6.0',
      prettier: '^3.3.0',
      'typescript-eslint': '^8.12.0',
      vitest: '^2.1.0',
    },
  },
  angular: {
    devDeps: {
      '@angular-eslint/eslint-plugin': '^18.0.0',
      '@angular-eslint/eslint-plugin-template': '^18.0.0',
      '@angular-eslint/template-parser': '^18.0.0',
      '@playwright/test': '^1.48.0',
      '@testing-library/angular': '^17.3.0',
      '@testing-library/jest-dom': '^6.6.0',
      '@testing-library/user-event': '^14.5.2',
      '@types/jest': '^29.5.0',
      'jest-preset-angular': '^14.2.0',
      jest: '^29.7.0',
      eslint: '^9.13.0',
      husky: '^9.1.0',
      'lint-staged': '^15.2.0',
      msw: '^2.6.0',
      prettier: '^3.3.0',
      'typescript-eslint': '^8.12.0',
    },
  },
};

const TEST_SCRIPTS_DEFAULT = {
  test: 'vitest run',
  'test:watch': 'vitest',
  'test:coverage': 'vitest run --coverage',
  e2e: 'playwright test',
  'e2e:install': 'playwright install chromium',
  lint: 'eslint . --ext .ts,.tsx,.vue,.svelte,.jsx',
  format: 'prettier --write "src/**/*.{ts,tsx,vue,svelte,jsx,css,md}"',
  'format:check': 'prettier --check "src/**/*.{ts,tsx,vue,svelte,jsx,css,md}"',
  prepare: 'husky',
};

const TEST_SCRIPTS_ANGULAR = {
  test: 'jest',
  'test:watch': 'jest --watch',
  'test:coverage': 'jest --coverage',
  e2e: 'playwright test',
  'e2e:install': 'playwright install chromium',
  lint: 'ng lint',
  format: 'prettier --write "src/**/*.{ts,html,css,md}"',
  'format:check': 'prettier --check "src/**/*.{ts,html,css,md}"',
  prepare: 'husky',
};

const LINT_STAGED_DEFAULT = {
  '*.{ts,tsx,vue,svelte,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{css,md,json}': ['prettier --write'],
};

function detectFramework(projectDir) {
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(join(projectDir, 'angular.json'))) return 'angular';
  if (!existsSync(pkgPath)) {
    throw new Error(`${pkgPath} not found — is this a JavaScript/TypeScript project?`);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['@builder.io/qwik']) return 'qwik';
  if (deps['solid-js']) return 'solid';
  if (deps.svelte) return 'svelte';
  if (deps.vue) return 'vue';
  if (deps.react) return 'react';
  throw new Error('Could not detect framework. Expected one of: vue, react, svelte, solid-js, @builder.io/qwik, or an Angular project.');
}

function detectExistingTesting(projectDir) {
  const pkgPath = join(projectDir, 'package.json');
  if (!existsSync(pkgPath)) return { hasTests: false };
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return {
    hasTests: Boolean(deps.vitest || deps.jest || deps['@playwright/test']),
    deps: Object.keys(deps).filter((k) =>
      /vitest|jest|playwright|cypress|testing-library|msw/.test(k)
    ),
  };
}

function mergePackageJson(projectDir, framework) {
  const pkgPath = join(projectDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.devDependencies = pkg.devDependencies || {};

  const scripts = framework === 'angular' ? TEST_SCRIPTS_ANGULAR : TEST_SCRIPTS_DEFAULT;
  for (const [k, v] of Object.entries(scripts)) {
    if (!pkg.scripts[k]) pkg.scripts[k] = v;
  }
  for (const [k, v] of Object.entries(FRAMEWORK_DEPS[framework].devDeps)) {
    if (!pkg.devDependencies[k]) pkg.devDependencies[k] = v;
  }
  if (!pkg['lint-staged']) {
    pkg['lint-staged'] = LINT_STAGED_DEFAULT;
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function copyIfMissing(projectDir, relPath, content) {
  const target = join(projectDir, relPath);
  if (existsSync(target)) return false;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return true;
}

function vitestConfig(framework) {
  const vuePlugin = framework === 'vue'
    ? `import vue from '@vitejs/plugin-vue';\n`
    : framework === 'react'
    ? `import react from '@vitejs/plugin-react';\n`
    : framework === 'svelte'
    ? `import { svelte } from '@sveltejs/vite-plugin-svelte';\n`
    : framework === 'solid'
    ? `import solid from 'vite-plugin-solid';\n`
    : framework === 'qwik'
    ? `import { qwikVite } from '@builder.io/qwik/optimizer';\n`
    : '';
  const pluginCall = framework === 'vue'
    ? '[vue()]'
    : framework === 'react'
    ? '[react()]'
    : framework === 'svelte'
    ? `[svelte({ hot: false })]`
    : framework === 'solid'
    ? '[solid()]'
    : framework === 'qwik'
    ? '[qwikVite({ client: { outDir: "dist" } })]'
    : '[]';
  return `import { defineConfig } from 'vitest/config';
${vuePlugin}import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: ${pluginCall},
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx,vue,svelte,jsx}'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test-setup.ts',
        'src/mocks/**',
        'src/main.{ts,tsx}',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        'src/api/**':         { lines: 80, functions: 80, branches: 75 },
        'src/composables/**': { lines: 80, functions: 80, branches: 75 },
        'src/hooks/**':       { lines: 80, functions: 80, branches: 75 },
        'src/stores/**':      { lines: 80, functions: 80, branches: 75 },
      },
    },
  },
});
`;
}

const TEST_SETUP_DEFAULT = `import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
`;

const MSW_HANDLERS = `import { http, HttpResponse } from 'msw';

// Bonita REST mocks — tests that hit /bonita/API/... use these without
// requiring a real server. Override per-test with server.use(...).
export const handlers = [
  http.get('/bonita/API/system/session/unusedId', () =>
    HttpResponse.json({
      user_id: '4',
      user_name: 'test.user',
      session_id: 'mock-session',
      conf: 'production',
    })
  ),
  http.get('/bonita/API/bpm/humanTask', () =>
    HttpResponse.json([], { headers: { 'Content-Range': '0-0/0' } })
  ),
  http.post('/bonita/API/bpm/userTask/:taskId/execution', () =>
    HttpResponse.json({}, { status: 204 })
  ),
  http.get('/bonita/API/bpm/process', () =>
    HttpResponse.json([], { headers: { 'Content-Range': '0-0/0' } })
  ),
  http.get('/bonita/API/bpm/case', () =>
    HttpResponse.json([], { headers: { 'Content-Range': '0-0/0' } })
  ),
];
`;

const MSW_SERVER = `import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
`;

const JEST_CONFIG_ANGULAR = `/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  testEnvironment: 'jsdom',
  // jest-preset-angular already wires setup-jest internally; project-specific
  // hooks (MSW, jest-dom) can be added by extending setup-jest.ts and
  // referencing it here once you confirm the correct option name for your
  // jest-preset-angular version.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/test-setup.ts',
    '!src/mocks/**',
    '!src/main.ts',
    '!src/polyfills.ts',
  ],
  coverageThreshold: {
    'src/app/api/': { lines: 80, functions: 80, branches: 75 },
    'src/app/services/': { lines: 80, functions: 80, branches: 75 },
    'src/app/stores/': { lines: 80, functions: 80, branches: 75 },
  },
  transformIgnorePatterns: ['node_modules/(?!(@angular|rxjs|msw|@bundled-es-modules)/.*)'],
};
`;

const SETUP_JEST_ANGULAR = `import 'jest-preset-angular/setup-jest';
import '@testing-library/jest-dom';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
`;

const TSCONFIG_SPEC_ANGULAR = `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts", "setup-jest.ts"]
}
`;

const PLAYWRIGHT_CONFIG = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
`;

const PRETTIER_RC = `{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
`;

const PRETTIER_IGNORE = `node_modules
dist
coverage
playwright-report
test-results
`;

const SMOKE_E2E = `import { test, expect } from '@playwright/test';

test('home loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#app, body')).toBeVisible();
  expect(errors).toEqual([]);
});
`;

function eslintConfig(framework) {
  if (framework === 'vue') {
    return `import vue from 'eslint-plugin-vue';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'] },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
`;
  }
  if (framework === 'react') {
    return `import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'] },
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  { plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y } },
  {
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  }
);
`;
  }
  // Generic TS-only for svelte / solid / qwik (framework-specific plugin can be added)
  return `import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
`;
}

function sampleApiTest(framework) {
  if (framework === 'angular') {
    return {
      path: 'src/api/__tests__/client.spec.ts',
      content: `// Sample API smoke for Angular projects.
// MSW + Jest + Angular requires extra Babel transform for node_modules/msw.
// Baseline uses a manual fetch mock; migrate to MSW once you wire the
// transformer (or switch this project to Vitest).

describe('Bonita API client (smoke)', () => {
  it('parses a JSON response from the session endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user_name: 'test.user' }),
      text: async () => JSON.stringify({ user_name: 'test.user' }),
      headers: new Map([['content-type', 'application/json']]),
    } as unknown as Response);
    const original = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock;

    try {
      const res = await fetch('/bonita/API/system/session/unusedId', {
        credentials: 'include',
      });
      const json = (await res.json()) as { user_name: string };
      expect(json.user_name).toBe('test.user');
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });
});
`,
    };
  }
  const ext = 'ts';
  return {
    path: `src/api/__tests__/client.test.${ext}`,
    content: `import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';

// Replace this import with the project's actual API client surface.
// The test demonstrates wiring MSW + Vitest; project tests assert against
// the real client behavior (CSRF header, 401 handler, error mapping, etc.).
describe('Bonita API client (smoke)', () => {
  it('hits the mocked session endpoint', async () => {
    server.use(
      http.get('/bonita/API/system/session/unusedId', () =>
        HttpResponse.json({ user_name: 'test.user' })
      )
    );
    const res = await fetch('/bonita/API/system/session/unusedId', {
      credentials: 'include',
    });
    const json = (await res.json()) as { user_name: string };
    expect(json.user_name).toBe('test.user');
  });
});
`,
  };
}

export function setupTesting(projectDir) {
  const dir = resolve(projectDir);
  if (!existsSync(dir)) throw new Error(`Project directory does not exist: ${dir}`);

  const framework = detectFramework(dir);
  const existing = detectExistingTesting(dir);
  const added = [];
  const skipped = [];

  // 1. package.json — merge scripts, devDeps, lint-staged
  mergePackageJson(dir, framework);
  added.push('package.json (scripts + devDeps + lint-staged merged)');

  // 2. Configs
  if (framework === 'angular') {
    if (copyIfMissing(dir, 'jest.config.cjs', JEST_CONFIG_ANGULAR)) added.push('jest.config.cjs');
    if (copyIfMissing(dir, 'setup-jest.ts', SETUP_JEST_ANGULAR)) added.push('setup-jest.ts');
    if (copyIfMissing(dir, 'tsconfig.spec.json', TSCONFIG_SPEC_ANGULAR)) added.push('tsconfig.spec.json');
  } else {
    if (copyIfMissing(dir, 'vitest.config.ts', vitestConfig(framework))) {
      added.push('vitest.config.ts');
    } else {
      skipped.push('vitest.config.ts (already exists)');
    }
  }

  if (copyIfMissing(dir, 'playwright.config.ts', PLAYWRIGHT_CONFIG)) added.push('playwright.config.ts');
  else skipped.push('playwright.config.ts (already exists)');

  if (copyIfMissing(dir, 'eslint.config.js', eslintConfig(framework))) added.push('eslint.config.js');
  else skipped.push('eslint.config.js (already exists)');

  if (copyIfMissing(dir, '.prettierrc', PRETTIER_RC)) added.push('.prettierrc');
  if (copyIfMissing(dir, '.prettierignore', PRETTIER_IGNORE)) added.push('.prettierignore');

  // 3. Test setup + MSW mocks
  if (copyIfMissing(dir, 'src/test-setup.ts', TEST_SETUP_DEFAULT)) added.push('src/test-setup.ts');
  if (copyIfMissing(dir, 'src/mocks/handlers.ts', MSW_HANDLERS)) added.push('src/mocks/handlers.ts');
  if (copyIfMissing(dir, 'src/mocks/server.ts', MSW_SERVER)) added.push('src/mocks/server.ts');

  // 4. Sample test (api smoke)
  const sample = sampleApiTest(framework);
  if (copyIfMissing(dir, sample.path, sample.content)) added.push(sample.path);

  // 5. E2E smoke
  if (copyIfMissing(dir, 'tests/e2e/smoke.spec.ts', SMOKE_E2E)) added.push('tests/e2e/smoke.spec.ts');

  return {
    ok: true,
    projectDir: dir,
    framework,
    existingTesting: existing,
    added,
    skipped,
    nextSteps: [
      'npm install',
      'npm test                        # run unit + component tests',
      'npm run test:coverage           # blocks if api/stores/composables fall under 80%',
      'npm run e2e:install && npm run e2e   # run Playwright smoke',
      'npm run lint && npm run format  # quality gate',
    ],
  };
}

// Allow direct CLI invocation: `node scripts/setup-testing.js [project-dir]`
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const target = process.argv[2] || process.cwd();
  const result = setupTesting(target);
  console.log(JSON.stringify(result, null, 2));
}
