// Wrap an EXISTING React/Vue/Angular project into a Bonita custom page.
// The client already has a working SPA. We add:
//   - page.properties at the root (if missing)
//   - scripts/package-bonita.js + scripts/copy-docs.js
//   - docs/DEPLOY-README.{md,html} (multilingual)
//   - build.sh + build.bat
//   - "dist" + "build:bonita" scripts in package.json (if missing)
// And we VERIFY (warning, not failure):
//   - vite.config base: './'
//   - hash routing
//   - withCredentials in HTTP layer

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLKIT_ROOT = resolve(__dirname, '..');

export async function wrap(flags) {
  const targetDir = resolve(flags['target-dir'] || flags.targetDir || process.cwd());
  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  const detected = await detectFramework(targetDir);
  const framework = flags.framework || detected;
  if (!framework) {
    throw new Error(
      'Could not detect framework. Pass --framework=react|vue|angular explicitly.'
    );
  }

  const name = flags.name;
  if (!name || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
    throw new Error('--name must be camelCase letters/digits, starting with a letter');
  }

  const displayName = flags['display-name'] || flags.displayName || name;
  const appToken = flags['app-token'] || flags.appToken;
  if (!appToken) {
    throw new Error('--app-token is required');
  }
  const pageToken = flags['page-token'] || flags.pageToken || 'home';

  const created = [];
  const warnings = [];

  // 1. page.properties
  const pagePropsPath = join(targetDir, 'page.properties');
  if (!existsSync(pagePropsPath)) {
    await writeFile(
      pagePropsPath,
      `name=custompage_${name}\n` +
      `displayName=${displayName}\n` +
      `description=Bonita custom page (${framework}) bound to ${appToken}/${pageToken}\n` +
      `contentType=page\n`
    );
    created.push('page.properties');
  } else {
    warnings.push('page.properties already exists — left untouched. Verify name and contentType.');
  }

  // 2. scripts/package-bonita.js + copy-docs.js
  await mkdir(join(targetDir, 'scripts'), { recursive: true });
  const isAngular = framework === 'angular';
  const projectName = await readProjectName(targetDir, framework);
  const distDirForAngular = isAngular ? `dist/${projectName}/browser` : 'dist';
  const zipName = `page-${name}.zip`;

  const packageScript = packagingScriptContent({
    distDir: distDirForAngular,
    outputFile: `dist/${zipName}`,
  });
  const packageScriptPath = join(targetDir, 'scripts', 'package-bonita.js');
  if (!existsSync(packageScriptPath)) {
    await writeFile(packageScriptPath, packageScript);
    created.push('scripts/package-bonita.js');
  }

  const copyDocsScript = copyDocsScriptContent();
  const copyDocsPath = join(targetDir, 'scripts', 'copy-docs.js');
  if (!existsSync(copyDocsPath)) {
    await writeFile(copyDocsPath, copyDocsScript);
    created.push('scripts/copy-docs.js');
  }

  // 3. docs/DEPLOY-README.{md,html} from toolkit's reference docs (with substitutions)
  await mkdir(join(targetDir, 'docs'), { recursive: true });
  const subs = {
    '__NAME__': name,
    '__DISPLAY_NAME__': displayName,
    '__APP_TOKEN__': appToken,
    '__PAGE_TOKEN__': pageToken,
    '__ZIP_NAME__': zipName,
    '__FRAMEWORK__': framework,
    '__FRAMEWORK_LABEL__': frameworkLabel(framework),
  };

  for (const file of ['DEPLOY-README.md', 'DEPLOY-README.html']) {
    const srcPath = join(TOOLKIT_ROOT, 'templates', 'shared-docs', file);
    if (existsSync(srcPath)) {
      let content = await readFile(srcPath, 'utf8');
      for (const [k, v] of Object.entries(subs)) {
        content = content.split(k).join(v);
      }
      const destPath = join(targetDir, 'docs', file);
      if (!existsSync(destPath)) {
        await writeFile(destPath, content);
        created.push(`docs/${file}`);
      }
    }
  }

  // 4. build.sh and build.bat
  const buildShPath = join(targetDir, 'build.sh');
  if (!existsSync(buildShPath)) {
    await writeFile(buildShPath, buildShContent({ zipName }));
    created.push('build.sh');
  }
  const buildBatPath = join(targetDir, 'build.bat');
  if (!existsSync(buildBatPath)) {
    await writeFile(buildBatPath, buildBatContent({ zipName }));
    created.push('build.bat');
  }

  // 5. Update package.json: add `dist` and `build:bonita` scripts if missing
  const pkgJsonPath = join(targetDir, 'package.json');
  if (existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    let pkgChanged = false;
    if (!pkg.scripts['build:bonita']) {
      if (isAngular) {
        pkg.scripts['build:bonita'] =
          `ng build --configuration=production && cross-env DIST_DIR=${distDirForAngular} node scripts/package-bonita.js`;
      } else {
        pkg.scripts['build:bonita'] = `vite build && node scripts/package-bonita.js`;
      }
      pkgChanged = true;
    }
    if (!pkg.scripts['dist']) {
      pkg.scripts['dist'] = 'npm run build:bonita && node scripts/copy-docs.js';
      pkgChanged = true;
    }
    if (!pkg.devDependencies?.archiver) {
      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies.archiver = '^7.0.0';
      pkgChanged = true;
    }
    if (isAngular && !pkg.devDependencies?.['cross-env']) {
      pkg.devDependencies['cross-env'] = '^7.0.3';
      pkgChanged = true;
    }
    if (pkgChanged) {
      await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      created.push('package.json (scripts/devDeps updated)');
    }
  }

  // 6. Sanity checks (don't fail, just warn)
  await checkConfigs(targetDir, framework, warnings);

  return {
    framework: frameworkLabel(framework),
    projectDir: targetDir,
    name,
    displayName,
    appToken,
    pageToken,
    pagePropertiesName: `custompage_${name}`,
    zipName,
    filesCreated: created,
    warnings,
    nextSteps: [
      'npm install   (ensures archiver and any new devDeps are installed)',
      'npm run dist  (or ./build.sh)',
      'Upload dist/' + zipName + ' to Bonita and bind it to your application.',
    ],
  };
}

async function detectFramework(dir) {
  if (existsSync(join(dir, 'angular.json'))) return 'angular';
  if (existsSync(join(dir, 'package.json'))) {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps['@angular/core']) return 'angular';
    if (deps.vue) return 'vue';
    if (deps.react) return 'react';
  }
  return null;
}

async function readProjectName(dir, framework) {
  if (framework === 'angular' && existsSync(join(dir, 'angular.json'))) {
    const ang = JSON.parse(await readFile(join(dir, 'angular.json'), 'utf8'));
    return Object.keys(ang.projects || {})[0] || 'app';
  }
  if (existsSync(join(dir, 'package.json'))) {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    return pkg.name || 'app';
  }
  return 'app';
}

function frameworkLabel(f) {
  return { react: 'React', vue: 'Vue 3', angular: 'Angular' }[f] || f;
}

async function checkConfigs(dir, framework, warnings) {
  // Vite base
  if (framework === 'react' || framework === 'vue') {
    const viteCfgFiles = ['vite.config.ts', 'vite.config.js'];
    for (const f of viteCfgFiles) {
      if (existsSync(join(dir, f))) {
        const c = await readFile(join(dir, f), 'utf8');
        if (!/base\s*:\s*['"]\.\//.test(c) && !/base\s*:\s*command\s*===\s*['"]build['"]/.test(c)) {
          warnings.push(
            `${f}: Vite \`base\` should be './' (or computed for build). Without it, deployed assets 404.`
          );
        }
      }
    }
  }

  // Angular baseHref
  if (framework === 'angular' && existsSync(join(dir, 'angular.json'))) {
    const ang = JSON.parse(await readFile(join(dir, 'angular.json'), 'utf8'));
    const projects = Object.values(ang.projects || {});
    for (const proj of projects) {
      const baseHref = proj?.architect?.build?.options?.baseHref;
      if (baseHref !== './') {
        warnings.push(
          `angular.json: architect.build.options.baseHref should be "./" (current: ${baseHref || 'unset'}).`
        );
      }
    }
  }

  // Hash routing — best-effort grep
  if (framework === 'react') {
    const grep = await grepInDir(dir, /createBrowserRouter|BrowserRouter/);
    if (grep) {
      warnings.push(
        `Found ${grep} — must use createHashRouter / HashRouter for refresh-safe deployment in Bonita.`
      );
    }
  } else if (framework === 'vue') {
    const grep = await grepInDir(dir, /createWebHistory(?!Hash)/);
    if (grep) {
      warnings.push(
        `Found ${grep} — must use createWebHashHistory for refresh-safe deployment.`
      );
    }
  } else if (framework === 'angular') {
    const grep = await grepInDir(dir, /PathLocationStrategy|provideRouter\(routes\)(?!.*withHashLocation)/);
    if (grep && !(await grepInDir(dir, /HashLocationStrategy|withHashLocation/))) {
      warnings.push(
        `Could not confirm HashLocationStrategy / withHashLocation() in app.config — verify it's set.`
      );
    }
  }
}

async function grepInDir(dir, pattern) {
  const { readdir, readFile } = await import('node:fs/promises');
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        const r = await walk(p);
        if (r) return r;
      } else if (/\.(ts|tsx|js|jsx|vue)$/.test(e.name)) {
        const c = await readFile(p, 'utf8');
        if (pattern.test(c)) return p;
      }
    }
    return null;
  }
  return walk(dir);
}

// ── Embedded script templates ────────────────────────────────────

function packagingScriptContent({ distDir, outputFile }) {
  return `import { createWriteStream, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import archiver from 'archiver';

const DIST_DIR = process.env.DIST_DIR || ${JSON.stringify(distDir)};
const OUTPUT_FILE = process.env.OUTPUT_FILE || ${JSON.stringify(outputFile)};
const PAGE_PROPERTIES = 'page.properties';

if (!existsSync(PAGE_PROPERTIES)) {
  console.error(\`Missing \${PAGE_PROPERTIES} at project root\`);
  process.exit(1);
}
if (!existsSync(DIST_DIR) || !existsSync(join(DIST_DIR, 'index.html'))) {
  console.error(\`Build output missing: \${DIST_DIR}/index.html\`);
  console.error('Did you run "npm run build" first?');
  process.exit(1);
}

function addDirToArchive(archive, dirPath, archivePath) {
  for (const entry of readdirSync(dirPath)) {
    if (entry.endsWith('.zip')) continue;
    if (entry === 'page.properties') continue;
    const fullPath = join(dirPath, entry);
    const entryArchivePath = archivePath ? \`\${archivePath}/\${entry}\` : entry;
    if (statSync(fullPath).isDirectory()) {
      addDirToArchive(archive, fullPath, entryArchivePath);
    } else {
      archive.file(fullPath, { name: entryArchivePath });
    }
  }
}

async function packageBonita() {
  console.log(\`Packaging \${DIST_DIR} → \${OUTPUT_FILE}\`);
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.file(PAGE_PROPERTIES, { name: 'page.properties' });
  addDirToArchive(archive, DIST_DIR, 'resources');
  await archive.finalize();
  console.log(\`Done: \${OUTPUT_FILE} (\${archive.pointer()} bytes)\`);
}

packageBonita().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
`;
}

function copyDocsScriptContent() {
  return `// Copy deployment docs alongside the ZIP in dist/.
// These are reference files for whoever receives the ZIP — they are NOT
// included in the ZIP itself (Bonita only needs page.properties + resources/).

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const SOURCES = [
  ['docs/DEPLOY-README.md',   'DEPLOY-README.md'],
  ['docs/DEPLOY-README.html', 'DEPLOY-README.html'],
];

if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

let copied = 0;
for (const [src, name] of SOURCES) {
  if (!existsSync(src)) {
    console.warn(\`(skipped, missing) \${src}\`);
    continue;
  }
  copyFileSync(src, join(DIST_DIR, name));
  console.log(\`Copied \${src} → \${join(DIST_DIR, name)}\`);
  copied++;
}
console.log(\`Docs copied: \${copied}\`);
`;
}

function buildShContent({ zipName }) {
  return `#!/usr/bin/env bash
# Generated by bonita-page wrap. Build the Bonita custom page.

set -e
cd "$(dirname "$0")"
cmd="\${1:-all}"

case "$cmd" in
  all)
    [ ! -d node_modules ] && npm install
    npm run dist
    ;;
  install) npm install ;;
  build)   npm run build:bonita ;;
  dist)    npm run dist ;;
  *) echo "Usage: $0 [install|build|dist]"; exit 1 ;;
esac

echo
echo "Output:"
ls -lh dist/${zipName} 2>/dev/null && echo "  └─ upload to Bonita resource-list"
`;
}

function buildBatContent({ zipName }) {
  return `@echo off
rem Generated by bonita-page wrap. Build the Bonita custom page.

setlocal enableextensions
cd /d "%~dp0"

set "CMD=%~1"
if "%CMD%"=="" goto all
if /I "%CMD%"=="install" goto install
if /I "%CMD%"=="build"   goto build
if /I "%CMD%"=="dist"    goto dist
echo Usage: %~nx0 [install^|build^|dist]
exit /b 1

:all
if not exist node_modules call npm install
call npm run dist
goto print

:install
call npm install
exit /b %errorlevel%

:build
call npm run build:bonita
goto print

:dist
call npm run dist
goto print

:print
echo.
echo Output:
if exist "dist\\${zipName}" echo   %CD%\\dist\\${zipName}
exit /b 0
`;
}
