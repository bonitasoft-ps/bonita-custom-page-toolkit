// `bonita-page test` — runs the project's test suite by delegating to its
// own `npm test` (or `npm run test:coverage` if --coverage is passed).
// Errors propagate as non-zero exit codes so CI flags failures correctly.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export async function runTests(flags) {
  const projectDir = resolve(flags.projectDir || flags['project-dir'] || process.cwd());
  const coverage = Boolean(flags.coverage);
  const e2e = Boolean(flags.e2e);

  if (!existsSync(join(projectDir, 'package.json'))) {
    return { ok: false, reason: `package.json not found at ${projectDir}` };
  }

  const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};

  let scriptName;
  if (e2e) {
    scriptName = scripts.e2e ? 'e2e' : null;
  } else if (coverage) {
    scriptName = scripts['test:coverage'] ? 'test:coverage' : scripts.test ? 'test' : null;
  } else {
    scriptName = scripts.test ? 'test' : null;
  }

  if (!scriptName) {
    return {
      ok: false,
      reason: `No matching script in package.json. Run "bonita-page setup-testing" first to install the toolkit's testing standard.`,
      projectDir,
    };
  }

  return new Promise((resolvePromise) => {
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? 'npm.cmd' : 'npm', ['run', scriptName], {
      cwd: projectDir,
      stdio: 'inherit',
      shell: isWin,
    });
    child.on('error', (err) => {
      resolvePromise({ ok: false, reason: err.message, scriptName, projectDir });
    });
    child.on('close', (code) => {
      resolvePromise({ ok: code === 0, exitCode: code, scriptName, projectDir });
    });
  });
}
