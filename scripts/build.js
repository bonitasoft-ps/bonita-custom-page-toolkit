// Run install + build:bonita on a project directory.
// Used as a thin wrapper so a client can do `bonita-page build .` without
// remembering whether the project uses build.sh, npm run dist, or whatever.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export async function build(projectDir) {
  const dir = resolve(projectDir);

  if (!existsSync(join(dir, 'package.json'))) {
    throw new Error(`No package.json in ${dir}. Is this a Node project?`);
  }

  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};

  // Install if node_modules missing
  if (!existsSync(join(dir, 'node_modules'))) {
    console.error('==> npm install');
    await runCmd('npm', ['install', '--no-audit', '--no-fund'], dir);
  }

  // Pick the best build script in priority order
  let target;
  if (scripts.dist) target = 'dist';
  else if (scripts['build:bonita']) target = 'build:bonita';
  else if (scripts.build) target = 'build';
  else throw new Error('No `dist`, `build:bonita` or `build` script in package.json');

  console.error(`==> npm run ${target}`);
  await runCmd('npm', ['run', target], dir);

  // Find the produced ZIP
  const distDir = join(dir, 'dist');
  let zip = null;
  if (existsSync(distDir)) {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(distDir).filter((f) => f.endsWith('.zip'));
    if (files.length === 1) zip = join(distDir, files[0]);
    else if (files.length > 1) {
      // Prefer page-*.zip
      const page = files.find((f) => f.startsWith('page-'));
      zip = page ? join(distDir, page) : join(distDir, files[0]);
    }
  }

  return {
    project: dir,
    target,
    zip,
    docs: {
      md: existsSync(join(distDir, 'DEPLOY-README.md')) ? join(distDir, 'DEPLOY-README.md') : null,
      html: existsSync(join(distDir, 'DEPLOY-README.html')) ? join(distDir, 'DEPLOY-README.html') : null,
    },
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
