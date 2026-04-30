// Read-only pre-flight check: verifies a project conforms to the rules in
// docs/WRAP-CHECKLIST.md before running `bonita-page wrap`. Modifies nothing.
//
// Returns:
//   - exit code 0 + { ok: true, ... } on success
//   - exit code 1 + { ok: false, issues: [...] } on issues
//
// Usage:
//   bonita-page check [project-dir]   # defaults to cwd

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export async function check(projectDir = process.cwd()) {
  const dir = resolve(projectDir);

  if (!existsSync(join(dir, 'package.json'))) {
    return {
      ok: false,
      framework: null,
      issues: [`No package.json found in ${dir}.`],
    };
  }

  const framework = await detectFramework(dir);
  if (!framework) {
    return {
      ok: false,
      framework: null,
      issues: [
        'Could not detect framework. Expected one of: @angular/core, vue, react, svelte, solid-js, @builder.io/qwik in package.json.',
      ],
    };
  }

  const issues = [];
  const checks = {
    buildOutputExists: false,
    relativeBasePath: false,
    hashRouting: false,
    credentialsInclude: false,
  };

  // 1. Build output exists (or at least we have the right config to produce one)
  await checkBuildConfig(dir, framework, issues, checks);

  // 2. Relative base path
  await checkBasePath(dir, framework, issues, checks);

  // 3. Hash routing
  await checkHashRouting(dir, framework, issues, checks);

  // 4. credentials: 'include' / withCredentials somewhere in src/
  await checkCredentials(dir, framework, issues, checks);

  return {
    ok: issues.length === 0,
    framework,
    projectDir: dir,
    checks,
    issues,
  };
}

// ── Framework detection ──────────────────────────────────────────────

async function detectFramework(dir) {
  if (existsSync(join(dir, 'angular.json'))) return 'angular';
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps['@angular/core']) return 'angular';
  if (deps['@builder.io/qwik']) return 'qwik';
  if (deps['solid-js']) return 'solid';
  if (deps.svelte) return 'svelte';
  if (deps.vue) return 'vue';
  if (deps.react) return 'react';
  return null;
}

// ── Check 1: build output / config ───────────────────────────────────

async function checkBuildConfig(dir, framework, issues, checks) {
  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};

  const hasBuildScript =
    scripts.build || scripts['build:bonita'] || scripts.dist;
  if (!hasBuildScript) {
    issues.push(
      'package.json: no `build`, `build:bonita`, or `dist` script. Add a script that produces a static bundle.'
    );
  }
  checks.buildOutputExists = Boolean(hasBuildScript);
}

// ── Check 2: relative base path ──────────────────────────────────────

async function checkBasePath(dir, framework, issues, checks) {
  if (framework === 'angular') {
    const angularJsonPath = join(dir, 'angular.json');
    if (!existsSync(angularJsonPath)) {
      issues.push('angular.json not found. Cannot verify baseHref.');
      return;
    }
    const ng = JSON.parse(await readFile(angularJsonPath, 'utf8'));
    const projects = Object.values(ng.projects || {});
    let allOk = projects.length > 0;
    for (const proj of projects) {
      const baseHref = proj?.architect?.build?.options?.baseHref;
      if (baseHref !== './') {
        issues.push(
          `angular.json: architect.build.options.baseHref is "${baseHref || 'unset'}" — must be "./" or assets will 404 in Bonita.`
        );
        allOk = false;
      }
    }
    checks.relativeBasePath = allOk;
    return;
  }

  // Vite-based frameworks
  for (const cfg of ['vite.config.ts', 'vite.config.js']) {
    const p = join(dir, cfg);
    if (!existsSync(p)) continue;
    const content = await readFile(p, 'utf8');
    const ok =
      /base\s*:\s*['"]\.\//.test(content) ||
      /base\s*:\s*command\s*===\s*['"]build['"]/.test(content);
    if (!ok) {
      issues.push(
        `${cfg}: \`base\` is not "./" (or a command-aware variant). Deployed assets will 404. Set \`base: './'\`.`
      );
    }
    checks.relativeBasePath = ok;
    return;
  }
  issues.push('No vite.config.ts or vite.config.js found.');
}

// ── Check 3: hash routing ────────────────────────────────────────────

async function checkHashRouting(dir, framework, issues, checks) {
  // Look for indicators per framework. We grep src/.
  const indicators = {
    react:   /createHashRouter|HashRouter/,
    vue:     /createWebHashHistory/,
    angular: /HashLocationStrategy|withHashLocation/,
    svelte:  /svelte-spa-router/,
    solid:   /from ['"]@solidjs\/router['"][\s\S]{0,200}HashRouter/,
    qwik:    null, // Qwik uses manual `route` signals; we skip this check
  };

  if (framework === 'qwik') {
    // Qwik routing is manual — accept either way and warn the user
    checks.hashRouting = true;
    return;
  }

  const pattern = indicators[framework];
  if (!pattern) {
    checks.hashRouting = true;
    return;
  }

  const found = await grepInDir(dir, pattern);
  if (found) {
    checks.hashRouting = true;
  } else {
    issues.push(
      `Hash routing not detected. ${framework} requires ${routerHint(framework)} for refresh-safe deployment in Bonita.`
    );
    // Also flag the explicit anti-pattern
    const browserRouterMap = {
      react: /createBrowserRouter|<BrowserRouter/,
      vue: /createWebHistory(?!Hash)/,
      angular: /PathLocationStrategy/,
      solid: /import\s*{[^}]*Router[^}]*}\s*from\s*['"]@solidjs\/router['"][\s\S]{0,200}<Router/,
    };
    const antiPattern = browserRouterMap[framework];
    if (antiPattern) {
      const anti = await grepInDir(dir, antiPattern);
      if (anti) {
        issues.push(
          `Found ${anti} — replace browser routing with hash routing.`
        );
      }
    }
  }
}

function routerHint(framework) {
  return ({
    react: 'createHashRouter',
    vue: 'createWebHashHistory',
    angular: 'withHashLocation()',
    svelte: 'svelte-spa-router',
    solid: 'HashRouter from @solidjs/router',
    qwik: 'a manual route signal',
  })[framework] || 'hash routing';
}

// ── Check 4: credentials ─────────────────────────────────────────────

async function checkCredentials(dir, framework, issues, checks) {
  const found = await grepInDir(
    dir,
    /credentials\s*:\s*['"]include['"]|withCredentials\s*:\s*true|X-Bonita-API-Token/
  );
  if (found) {
    checks.credentialsInclude = true;
  } else {
    issues.push(
      `No fetch with credentials:'include' or HttpClient withCredentials found. ` +
      `Bonita session cookies won't be sent.`
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function grepInDir(dir, pattern) {
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      if (
        e.name === 'node_modules' ||
        e.name === 'dist' ||
        e.name === '.angular' ||
        e.name === '.qwik' ||
        e.name === '.cache' ||
        e.name.startsWith('.')
      ) {
        continue;
      }
      const p = join(d, e.name);
      if (e.isDirectory()) {
        const r = await walk(p);
        if (r) return r;
      } else if (/\.(ts|tsx|js|jsx|vue|svelte)$/.test(e.name)) {
        let c;
        try {
          c = await readFile(p, 'utf8');
        } catch {
          continue;
        }
        if (pattern.test(c)) return p;
      }
    }
    return null;
  }
  return walk(dir);
}
