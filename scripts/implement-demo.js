// `bonita-page implement-demo` — generate a complete framework-specific
// demo from a domain spec. Orchestrates: validate spec → scaffold project
// → generate types/seeds (framework-agnostic) → generate stores + pages +
// router (framework-specific) → apply palette → optionally wire testing →
// wrap + build.
//
// Spec contract: docs/FUTURE-TOOLS.md (DemoSpec definition).
// Output: { ok, framework, projectDir, zipPath, filesGenerated, nextSteps }.

import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { scaffold } from './scaffold.js';
import { wrap as wrapProject } from './wrap.js';
import { build as buildProject } from './build.js';
import { setupTesting } from './setup-testing.js';
import { validateSpec } from './implement-demo/validate-spec.js';
import { generateDomain } from './implement-demo/generate-domain.js';
import { applyPalette } from './implement-demo/apply-palette.js';
import { makeStub } from './implement-demo/frameworks/stub.js';

const SUPPORTED_FRAMEWORKS = ['react', 'vue', 'angular', 'svelte', 'solid', 'qwik'];

async function loadAdapter(framework) {
  try {
    const mod = await import(`./implement-demo/frameworks/${framework}.js`);
    return {
      FRAMEWORK: mod.FRAMEWORK,
      generateStores: mod.generateStores,
      generatePages: mod.generatePages,
      generateRouter: mod.generateRouter,
      notSupportedMessage: null,
    };
  } catch {
    return makeStub(framework);
  }
}

export async function implementDemo(args) {
  const {
    framework,
    name,
    appToken,
    displayName,
    pageToken,
    targetDir,
    spec,
    includeTesting = true,
    skipBuild = false,
  } = args;

  if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
    return {
      ok: false,
      reason: `framework must be one of: ${SUPPORTED_FRAMEWORKS.join(', ')}`,
    };
  }

  const specCheck = validateSpec(spec);
  if (!specCheck.ok) {
    return { ok: false, reason: 'Spec validation failed', errors: specCheck.errors };
  }

  // 1. Scaffold the framework project — same code path as `bonita-page scaffold`.
  let scaffoldResult;
  try {
    scaffoldResult = await scaffold({
      framework,
      name,
      'app-token': appToken,
      'display-name': displayName,
      'page-token': pageToken,
      'target-dir': targetDir,
    });
  } catch (e) {
    return { ok: false, stoppedAt: 'scaffold', reason: e instanceof Error ? e.message : String(e) };
  }
  const projectDir = scaffoldResult.projectDir;
  if (!projectDir || !existsSync(projectDir)) {
    return { ok: false, stoppedAt: 'scaffold', reason: 'scaffold did not produce a usable projectDir' };
  }

  const filesGenerated = [];

  // 2. Domain layer (framework-agnostic)
  try {
    filesGenerated.push(...generateDomain(projectDir, spec));
  } catch (e) {
    return { ok: false, stoppedAt: 'generateDomain', projectDir, reason: e instanceof Error ? e.message : String(e) };
  }

  // 3. Palette into tokens.css
  try {
    applyPalette(projectDir, spec.palette || {});
  } catch (e) {
    // Non-fatal — palette is cosmetic
    console.warn('[implement-demo] palette application failed:', e instanceof Error ? e.message : e);
  }

  // 4. Framework-specific stores / pages / router
  const adapter = await loadAdapter(framework);
  const warnings = [];
  if (adapter.notSupportedMessage) {
    warnings.push(adapter.notSupportedMessage);
  } else {
    try {
      filesGenerated.push(...adapter.generateStores(projectDir, spec));
      filesGenerated.push(...adapter.generatePages(projectDir, spec));
      filesGenerated.push(...adapter.generateRouter(projectDir, spec));
    } catch (e) {
      return {
        ok: false,
        stoppedAt: `adapter:${framework}`,
        projectDir,
        reason: e instanceof Error ? e.message : String(e),
        filesGenerated,
      };
    }
  }

  // 5. Optional testing setup
  if (includeTesting) {
    try {
      const t = setupTesting(projectDir);
      filesGenerated.push(...(t.added || []));
    } catch (e) {
      warnings.push(`Testing setup failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 6. Optional build (skip for fast iteration; tests in CI will catch breakage)
  let zipPath = null;
  if (!skipBuild) {
    try {
      const b = await buildProject(projectDir);
      zipPath = b.zipPath || null;
    } catch (e) {
      warnings.push(`Build failed: ${e instanceof Error ? e.message : e}. Run \`cd ${projectDir} && npm install && npm run dist\` to retry.`);
    }
  }

  return {
    ok: true,
    framework,
    projectDir,
    zipPath,
    filesGenerated,
    warnings,
    nextSteps: [
      `cd ${projectDir}`,
      'npm install',
      'npm test                # if includeTesting=true (default)',
      'npm run dist            # → dist/page-*.zip',
      ...(adapter.notSupportedMessage
        ? [`# Note: ${framework} adapter is a stub — wire stores/pages by hand using examples/${framework}-directory-bonita/ as reference.`]
        : []),
    ],
  };
}
