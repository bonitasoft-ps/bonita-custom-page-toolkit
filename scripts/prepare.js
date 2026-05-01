// `bonita-page prepare` — orchestrator that runs the full pipeline in one call:
//   1. check    — read-only verification of the project
//   2. wrap     — adds Bonita layer (page.properties, scripts, docs)
//   3. install  — npm install if node_modules is missing
//   4. dist     — build:bonita + copy-docs → ZIP + deploy guides
//
// If any step fails, the orchestrator stops and reports which step and why.
// This is the "happy path" command for end users and AI agents — instead of
// chaining three subcommands manually, just run `bonita-page prepare`.
//
// Required flags (same as wrap): --name, --app-token. Optional: --display-name,
// --page-token (default 'home'), --target-dir (default cwd), --framework,
// --skip-check (proceed even if check has issues), --skip-install (don't run
// npm install — useful for projects with monorepo layouts).

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { check } from './check.js';
import { wrap } from './wrap.js';

export async function prepare(flags) {
  const targetDir = resolve(flags['target-dir'] || flags.targetDir || process.cwd());
  const skipCheck = Boolean(flags['skip-check'] || flags.skipCheck);
  const skipInstall = Boolean(flags['skip-install'] || flags.skipInstall);

  const stages = [];

  // ── Stage 1: check ─────────────────────────────────────────────────
  console.error('==> [1/4] check — verifying project conforms to wrap rules');
  const checkResult = await check(targetDir);
  stages.push({ stage: 'check', ok: checkResult.ok, summary: checkResult });

  if (!checkResult.ok && !skipCheck) {
    return {
      ok: false,
      stoppedAt: 'check',
      reason: 'Project failed pre-flight checks. Fix the issues below in src/ and re-run, or pass --skip-check to proceed anyway.',
      issues: checkResult.issues,
      stages,
    };
  }

  if (!checkResult.ok && skipCheck) {
    console.error(`    (warnings ignored due to --skip-check: ${checkResult.issues.length})`);
  }

  // ── Stage 2: wrap ──────────────────────────────────────────────────
  console.error('==> [2/4] wrap — adding Bonita layer (page.properties, scripts, docs)');
  let wrapResult;
  try {
    wrapResult = await wrap(flags);
    stages.push({ stage: 'wrap', ok: true, summary: wrapResult });
  } catch (e) {
    return {
      ok: false,
      stoppedAt: 'wrap',
      reason: e instanceof Error ? e.message : String(e),
      stages,
    };
  }

  // ── Stage 3: npm install (if needed) ───────────────────────────────
  if (!skipInstall && !existsSync(join(targetDir, 'node_modules'))) {
    console.error('==> [3/4] install — node_modules missing, running npm install');
    try {
      await runCmd('npm', ['install', '--no-audit', '--no-fund'], targetDir);
      stages.push({ stage: 'install', ok: true });
    } catch (e) {
      return {
        ok: false,
        stoppedAt: 'install',
        reason: e instanceof Error ? e.message : String(e),
        stages,
      };
    }
  } else {
    console.error(
      skipInstall
        ? '==> [3/4] install — skipped (--skip-install)'
        : '==> [3/4] install — skipped (node_modules already present)'
    );
    stages.push({ stage: 'install', ok: true, skipped: true });
  }

  // ── Stage 4: dist (build + ZIP + docs) ─────────────────────────────
  console.error('==> [4/4] dist — building ZIP + copying multilingual deploy docs');
  try {
    await runCmd('npm', ['run', 'dist'], targetDir);
    stages.push({ stage: 'dist', ok: true });
  } catch (e) {
    return {
      ok: false,
      stoppedAt: 'dist',
      reason: e instanceof Error ? e.message : String(e),
      stages,
    };
  }

  // ── Find the produced ZIP ──────────────────────────────────────────
  const distDir = join(targetDir, 'dist');
  let zipPath = null;
  if (existsSync(distDir)) {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(distDir).filter((f) => f.startsWith('page-') && f.endsWith('.zip'));
    if (files.length > 0) {
      zipPath = join(distDir, files[0]);
    }
  }

  return {
    ok: true,
    framework: wrapResult.framework,
    name: wrapResult.name,
    appToken: wrapResult.appToken,
    pageToken: wrapResult.pageToken,
    projectDir: targetDir,
    zipPath,
    docs: {
      md: existsSync(join(distDir, 'DEPLOY-README.md')) ? join(distDir, 'DEPLOY-README.md') : null,
      html: existsSync(join(distDir, 'DEPLOY-README.html')) ? join(distDir, 'DEPLOY-README.html') : null,
    },
    nextSteps: [
      `Upload ${zipPath ?? '(missing ZIP — check dist/)'} to Bonita`,
      'Bonita 2025.x: /bonita/apps/superAdminAppBonita/resource-list/ → +Add',
      `Then in application-list/, create or edit your '${wrapResult.appToken}' Application`,
      `Add the page with token '${wrapResult.pageToken}'`,
      `Open: http://{your-bonita-host}/bonita/apps/${wrapResult.appToken}/${wrapResult.pageToken}/?_l=en`,
    ],
    stages,
  };
}

function runCmd(cmd, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? `${cmd}.cmd` : cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: isWin,
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
