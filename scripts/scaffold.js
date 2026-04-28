// scaffold a new Bonita custom page project from a framework template.
//
// Required flags:
//   --framework=react|vue|angular
//   --name=<camelCase>          (used as `custompage_<name>` and ZIP filename)
//   --display-name="<text>"     (Bonita admin display label)
//   --app-token=<token>         (Application token, becomes /bonita/apps/{appToken}/)
//
// Optional:
//   --page-token=<token>        (Page token within the app, default: home)
//   --target-dir=<path>         (where to create the project, default: ./<name>)

import { mkdir, copyFile, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLKIT_ROOT = resolve(__dirname, '..');

const FRAMEWORKS = {
  react: { templateDir: 'react-vite-bonita', label: 'React + Vite' },
  vue: { templateDir: 'vue-vite-bonita', label: 'Vue 3 + Vite' },
  angular: { templateDir: 'angular-cli-bonita', label: 'Angular standalone' },
};

export async function scaffold(flags) {
  const framework = flags.framework;
  if (!framework || !FRAMEWORKS[framework]) {
    throw new Error(`--framework must be one of: ${Object.keys(FRAMEWORKS).join(', ')}`);
  }

  const name = flags.name;
  if (!name || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
    throw new Error('--name must be camelCase letters/digits, starting with a letter');
  }

  const displayName = flags['display-name'] || flags.displayName || name;
  const appToken = flags['app-token'] || flags.appToken;
  if (!appToken || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(appToken)) {
    throw new Error('--app-token must be camelCase letters/digits, starting with a letter');
  }
  const pageToken = flags['page-token'] || flags.pageToken || 'home';

  const targetDir = resolve(flags['target-dir'] || flags.targetDir || `./${name}`);
  if (existsSync(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  const templateDir = join(TOOLKIT_ROOT, 'templates', FRAMEWORKS[framework].templateDir);
  if (!existsSync(templateDir)) {
    throw new Error(
      `Template missing: ${templateDir}\n(Make sure you're running from a checkout of bonita-custom-page-toolkit.)`
    );
  }

  // Copy template recursively, applying token substitution to text files
  const replacements = {
    '__NAME__': name,
    '__DISPLAY_NAME__': displayName,
    '__APP_TOKEN__': appToken,
    '__PAGE_TOKEN__': pageToken,
    '__FRAMEWORK__': framework,
  };

  await copyTemplateTree(templateDir, targetDir, replacements);

  return {
    framework: FRAMEWORKS[framework].label,
    name,
    displayName,
    appToken,
    pageToken,
    projectDir: targetDir,
    pagePropertiesName: `custompage_${name}`,
    deployUrl: `http://{your-bonita-host}/bonita/apps/${appToken}/${pageToken}/?_l=en`,
    nextSteps: [
      `cd ${targetDir}`,
      'npm install',
      'npm run dist',
      'Upload dist/page-*.zip via Bonita 2025.x:',
      '  → /bonita/apps/superAdminAppBonita/resource-list/',
      `  → application-list → +Create app token=${appToken} layout="Layout Without Menu"`,
      `  → application-details → Pages → +Add page token=${pageToken}`,
    ],
  };
}

const TEXT_EXTENSIONS = new Set([
  '.json', '.js', '.ts', '.tsx', '.vue', '.html', '.css', '.md', '.properties',
  '.gitignore', '.env', '.bat', '.sh', '.conf', '.yml', '.yaml',
]);

function isTextFile(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return TEXT_EXTENSIONS.has(filename); // exact-match for dotfiles
  const ext = filename.slice(dot);
  return TEXT_EXTENSIONS.has(ext) || filename === '.env' || filename === '.gitignore';
}

// Files / directories that must NEVER be copied from a template — they're
// regenerable build artifacts or per-install lockfiles, and would just bloat
// the scaffolded project.
const SKIP_NAMES = new Set([
  'node_modules',
  'dist',
  '.angular',
  'out-tsc',
  'package-lock.json',
  '.vite',
  '.cache',
]);

async function copyTemplateTree(srcDir, destDir, replacements) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir);

  for (const entry of entries) {
    if (SKIP_NAMES.has(entry)) continue;

    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const st = await stat(srcPath);

    if (st.isDirectory()) {
      await copyTemplateTree(srcPath, destPath, replacements);
    } else if (isTextFile(entry)) {
      let content = await readFile(srcPath, 'utf8');
      for (const [k, v] of Object.entries(replacements)) {
        content = content.split(k).join(v);
      }
      await writeFile(destPath, content);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}
