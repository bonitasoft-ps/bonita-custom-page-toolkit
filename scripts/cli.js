#!/usr/bin/env node
// bonita-page CLI — single entry point for both human use (.sh/.bat) and MCP handlers.
// Subcommands: scaffold | wrap | check | validate | build | help

import { scaffold } from './scaffold.js';
import { wrap } from './wrap.js';
import { validate } from './validate.js';
import { build } from './build.js';
import { check } from './check.js';

const HELP = `bonita-page — generate, wrap, validate and build Bonita custom pages

USAGE
  bonita-page <command> [options]

COMMANDS
  scaffold    Create a NEW Bonita custom page project from a framework template
  wrap        Take an EXISTING SPA project and turn it into a Bonita custom page
  check       Pre-flight check: read-only verification that a project is ready to wrap
  validate    Verify a custom-page ZIP has the layout Bonita requires
  build       Run npm install + build:bonita on a project (wrapper for clients)
  help        Show this message

EXAMPLES
  # Scaffold a new React custom page
  bonita-page scaffold --framework=react --name=invoiceDashboard \\
      --display-name="Invoice Dashboard" --app-token=invoiceApp --page-token=home

  # Pre-flight check on an existing project (reads only, no modifications)
  cd /path/to/my-existing-app
  bonita-page check

  # Wrap an existing project (after 'check' passes)
  bonita-page wrap --framework=angular --name=myDashboard --app-token=myApp

  # Verify a ZIP before uploading
  bonita-page validate ./dist/page-myApp.zip

  # Build a project (install deps if needed, produce ZIP + multilingual docs)
  bonita-page build .

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
