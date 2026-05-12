// MCP handlers — thin wrappers that map tool calls to the same CLI Node functions.
// Designed to be registered into bonita-ai-agent-mcp (or any MCP server).
//
// Usage from a registering MCP server (pseudocode):
//
//   import { handlers } from '@bonitasoft-ps/bonita-custom-page-toolkit/mcp/handlers/index.js';
//
//   for (const [name, fn] of Object.entries(handlers)) {
//     server.registerTool(name, fn);
//   }
//
// Each handler returns a JSON-serializable object (or throws on error).

import { scaffold } from '../../scripts/scaffold.js';
import { wrap } from '../../scripts/wrap.js';
import { validate } from '../../scripts/validate.js';
import { build } from '../../scripts/build.js';
import { check } from '../../scripts/check.js';
import { prepare } from '../../scripts/prepare.js';
import { setupTesting } from '../../scripts/setup-testing.js';
import { runTests } from '../../scripts/test.js';
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLKIT_ROOT = resolve(__dirname, '..', '..');

function flagsFromArgs(args) {
  // MCP gives us camelCase keys; the CLI accepts both kebab and camel forms.
  // We pass the camel form straight through.
  return { ...args };
}

export const handlers = {
  async prepare_custom_page(args) {
    return prepare(flagsFromArgs(args));
  },

  async scaffold_custom_page(args) {
    return scaffold(flagsFromArgs(args));
  },

  async wrap_existing_app(args) {
    return wrap(flagsFromArgs(args));
  },

  async validate_custom_page_zip(args) {
    if (!args.zipPath) throw new Error('zipPath is required');
    return validate(args.zipPath);
  },

  async build_custom_page(args) {
    if (!args.projectDir) throw new Error('projectDir is required');
    return build(args.projectDir);
  },

  async check_custom_page_project(args = {}) {
    return check(args.projectDir || process.cwd());
  },

  async setup_testing_for_project(args = {}) {
    return setupTesting(args.projectDir || process.cwd());
  },

  async test_custom_page_project(args = {}) {
    return runTests({
      projectDir: args.projectDir,
      coverage: args.coverage,
      e2e: args.e2e,
    });
  },

  async get_deployment_guide({ version = '2025.x' } = {}) {
    const fileMap = {
      '7.x': 'docs/DEPLOYMENT.md',
      '2025.x': 'docs/DEPLOY_2025.md',
    };
    const file = fileMap[version];
    if (!file) {
      throw new Error(`Unknown version: ${version}. Allowed: 7.x, 2025.x`);
    }
    const content = await readFile(join(TOOLKIT_ROOT, file), 'utf8');
    return { version, file, content };
  },

  async list_custom_page_examples() {
    return {
      examples: [
        {
          name: 'react-directory-bonita',
          framework: 'React',
          path: 'examples/react-directory-bonita',
          description: 'Turnkey deploy to a custom Application (appDirectoryBonitaReact). Ships build.sh / build.bat with multilingual EN/FR/ES deploy docs. Includes the toolkit testing standard.',
        },
        {
          name: 'vue-directory-bonita',
          framework: 'Vue 3',
          path: 'examples/vue-directory-bonita',
          description: 'Vue equivalent of react-directory-bonita.',
        },
        {
          name: 'angular-directory-bonita',
          framework: 'Angular',
          path: 'examples/angular-directory-bonita',
          description: 'Angular equivalent of react-directory-bonita.',
        },
        {
          name: 'svelte-directory-bonita',
          framework: 'Svelte 5',
          path: 'examples/svelte-directory-bonita',
          description: 'Svelte 5 + svelte-spa-router (hash). Tiny ZIP (~22 KB). Same login + tasks scenario.',
        },
        {
          name: 'solid-directory-bonita',
          framework: 'SolidJS',
          path: 'examples/solid-directory-bonita',
          description: 'SolidJS + @solidjs/router. Smallest framework runtime (~14 KB gzip). React-like JSX without Virtual DOM.',
        },
        {
          name: 'qwik-directory-bonita',
          framework: 'Qwik',
          path: 'examples/qwik-directory-bonita',
          description: 'Qwik in SPA-only mode (no Qwik City). Resumability + automatic code-splitting (9 lazy chunks).',
        },
      ],
    };
  },
};

export default handlers;
