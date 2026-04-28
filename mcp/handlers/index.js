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
          name: 'react-task-viewer',
          framework: 'React',
          path: 'examples/react-task-viewer',
          description: 'Task list demo on default Bonita port (8080). Login + session probe + table.',
        },
        {
          name: 'vue-task-viewer',
          framework: 'Vue 3',
          path: 'examples/vue-task-viewer',
          description: 'Same scenario as React example, in Vue 3 + Pinia + Element Plus.',
        },
        {
          name: 'angular-task-viewer',
          framework: 'Angular',
          path: 'examples/angular-task-viewer',
          description: 'Same scenario in Angular standalone + signals. Uses APP_INITIALIZER for the session probe.',
        },
        {
          name: 'react-directory-bonita',
          framework: 'React',
          path: 'examples/react-directory-bonita',
          description: 'Turnkey deploy to a custom Application (appDirectoryBonitaReact). Ships build.sh / build.bat with multilingual EN/FR/ES deploy docs.',
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
      ],
    };
  },
};

export default handlers;
