#!/usr/bin/env node
// bonita-page CLI — single entry point for both human use (.sh/.bat) and MCP handlers.
// Subcommands: prepare | scaffold | wrap | check | validate | build | help

import { scaffold } from './scaffold.js';
import { wrap } from './wrap.js';
import { validate } from './validate.js';
import { build } from './build.js';
import { check } from './check.js';
import { prepare } from './prepare.js';
import { setupTesting } from './setup-testing.js';
import { runTests } from './test.js';
import { implementDemo } from './implement-demo.js';
import { readFileSync, existsSync } from 'node:fs';

const HELP = `bonita-page — generate, wrap, validate and build Bonita custom pages

USAGE
  bonita-page <command> [options]

COMMANDS
  prepare         ALL-IN-ONE: check + wrap + npm install + build → ZIP + deploy docs
  scaffold        Create a NEW Bonita custom page project from a framework template
  wrap            Take an EXISTING SPA project and turn it into a Bonita custom page
  check           Pre-flight check: read-only verification that a project is ready to wrap
  setup-testing   Add the toolkit's testing standard (Vitest + Testing Library + Playwright + MSW + ESLint + Prettier + husky)
  test            Run the project's tests (proxies to npm test / npm run test:coverage / npm run e2e)
  implement-demo  Generate a full demo (scaffold + types/seeds/stores/pages + tests + ZIP) from a DemoSpec JSON
  validate        Verify a custom-page ZIP has the layout Bonita requires
  build           Run npm install + build:bonita on a project (wrapper for clients)
  help            Show this message

EXAMPLES
  # ★ HAPPY PATH for clients: one command does everything
  cd /path/to/existing-app
  bonita-page prepare --name=myDashboard --app-token=myApp

  # Scaffold a new project from a template (no existing code)
  bonita-page scaffold --framework=react --name=invoiceDashboard \\
      --display-name="Invoice Dashboard" --app-token=invoiceApp

  # Pre-flight check only (read-only, no side effects)
  bonita-page check

  # Verify a ZIP before uploading
  bonita-page validate ./dist/page-myApp.zip

OPTIONS PER COMMAND
  scaffold:
    --framework=react|vue|angular     (required)
    --name=<camelCase>                Internal page name (becomes custompage_<name>)
    --display-name="<text>"           Shown in Bonita admin
    --app-token=<token>               Application token expected in URL
    --page-token=<token>              Page token within the application (default: home)
    --target-dir=<path>               Where to create the project (default: ./<name>)

  wrap:
    --framework=react|vue|angular     If omitted, detected from package.json/angular.json
    --name=<camelCase>                Internal page name
    --display-name="<text>"           Shown in Bonita admin
    --app-token=<token>
    --target-dir=<path>               Project to wrap (default: cwd)

  validate:
    <zip-path>                        Positional. Returns 0 if valid, 1 otherwise.

  build:
    [project-dir]                     Defaults to cwd. Runs ./build.sh dist or equivalent.
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [k, ...rest] = arg.slice(2).split('=');
      flags[k] = rest.length ? rest.join('=') : true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  const { positional, flags } = parseArgs(rest);

  try {
    switch (cmd) {
      case 'prepare': {
        const result = await prepare(flags);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
      }
      case 'scaffold': {
        const result = await scaffold(flags);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'wrap': {
        const result = await wrap(flags);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'validate': {
        const zip = positional[0];
        if (!zip) {
          console.error('validate: missing ZIP path');
          process.exit(2);
        }
        const result = await validate(zip);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 1);
      }
      case 'build': {
        const dir = positional[0] || process.cwd();
        const result = await build(dir);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'check': {
        const dir = positional[0] || process.cwd();
        const result = await check(dir);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
      }
      case 'setup-testing': {
        const dir = positional[0] || flags['project-dir'] || flags.projectDir || process.cwd();
        const result = setupTesting(dir);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
      }
      case 'test': {
        const result = await runTests({
          projectDir: positional[0] || flags['project-dir'] || flags.projectDir,
          coverage: flags.coverage,
          e2e: flags.e2e,
        });
        if (result.ok === false) {
          console.error(`Error: ${result.reason ?? 'tests failed'}`);
        }
        process.exit(result.ok ? 0 : (result.exitCode ?? 1));
      }
      case 'implement-demo': {
        // The spec is a JSON file path on disk — CLI doesn't accept inline JSON.
        const specPath = flags.spec || flags['spec-file'];
        if (!specPath || !existsSync(specPath)) {
          console.error('Error: --spec=<path-to-spec.json> is required');
          process.exit(2);
        }
        const spec = JSON.parse(readFileSync(specPath, 'utf8'));
        const result = await implementDemo({
          framework: flags.framework,
          name: flags.name,
          appToken: flags['app-token'] || flags.appToken,
          displayName: flags['display-name'] || flags.displayName,
          pageToken: flags['page-token'] || flags.pageToken,
          targetDir: flags['target-dir'] || flags.targetDir,
          spec,
          includeTesting: flags['no-testing'] ? false : true,
          skipBuild: Boolean(flags['skip-build']),
        });
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
      }
      default:
        console.error(`Unknown command: ${cmd}`);
        console.error('Run `bonita-page help` for usage.');
        process.exit(2);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    if (process.env.BONITA_PAGE_DEBUG) console.error(err);
    process.exit(1);
  }
}

main();
