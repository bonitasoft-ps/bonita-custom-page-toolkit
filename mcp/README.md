# MCP integration

This toolkit ships ready-to-register tools for any MCP server (Bonita-AI-Agent or otherwise).

## Tools provided

| Tool | Purpose |
|------|---------|
| `prepare_custom_page` | One-shot happy path: check + wrap + npm install + dist on an existing SPA |
| `scaffold_custom_page` | Create a NEW custom-page project (React / Vue / Angular / Svelte / Solid / Qwik) from a template |
| `wrap_existing_app` | Take an EXISTING SPA and add the Bonita custom-page layer (page.properties, packaging, docs) |
| `check_custom_page_project` | Read-only pre-flight check against the WRAP-CHECKLIST rules |
| `setup_testing_for_project` | Add the toolkit's testing standard (Vitest/Jest + Testing Library + Playwright + MSW + ESLint + Prettier + husky) |
| `test_custom_page_project` | Run the project's test suite (proxies to `npm test` / `npm run test:coverage` / `npm run e2e`) |
| `implement_demo_for_framework` | One-call generator: from a DemoSpec, produces scaffold + types/seeds/stores/pages/router + testing + ZIP. Vue adapter complete; other frameworks emit domain only (warning surfaces this). |
| `validate_custom_page_zip` | Check a ZIP has the layout Bonita requires |
| `build_custom_page` | Run install + build:bonita / dist on a project, return ZIP path |
| `get_deployment_guide` | Return the step-by-step guide for Bonita 7.x or 2025.x |
| `list_custom_page_examples` | List the bundled examples |

The tool spec is in [`spec/tools.json`](spec/tools.json). The handlers are in [`handlers/index.js`](handlers/index.js).

## Registering into `bonita-ai-agent-mcp`

The Bonita-AI-Agent MCP server lives in a separate repo. To make these tools available there:

### Option 1 — Direct import (preferred)

In the MCP server's tool registration code, add:

```ts
// somewhere in your MCP tool registration boot
import { handlers } from '@bonitasoft-ps/bonita-custom-page-toolkit/mcp/handlers/index.js';
import toolSpec from '@bonitasoft-ps/bonita-custom-page-toolkit/mcp/spec/tools.json' assert { type: 'json' };

for (const tool of toolSpec.tools) {
  const handler = handlers[tool.name];
  if (!handler) {
    console.warn(`Missing handler for ${tool.name}`);
    continue;
  }
  server.registerTool({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    handler,
  });
}
```

Add this package as a dependency:

```bash
npm install @bonitasoft-ps/bonita-custom-page-toolkit
```

### Option 2 — Subprocess invocation (no Node import)

If your MCP server is in Python or another language, shell out to the CLI:

```python
# Python example
import json, subprocess

def call_bonita_tool(tool_name, args):
    cmd_map = {
        'prepare_custom_page':        ['prepare'],
        'scaffold_custom_page':       ['scaffold'],
        'wrap_existing_app':          ['wrap'],
        'check_custom_page_project':  ['check'],
        'setup_testing_for_project':  ['setup-testing'],
        'test_custom_page_project':   ['test'],
        'implement_demo_for_framework': ['implement-demo'],
        'validate_custom_page_zip':   ['validate', args.pop('zipPath')],
        'build_custom_page':          ['build', args.pop('projectDir')],
    }
    cmd = ['node', 'path/to/bonita-custom-page-toolkit/scripts/cli.js'] + cmd_map[tool_name]
    for k, v in args.items():
        cmd.append(f'--{k}={v}')
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)
```

The CLI prints a single JSON object on success and returns 0; non-zero on error. `BONITA_PAGE_DEBUG=1` adds stack traces.

## Testing the handlers

```bash
# From the toolkit root
node -e "
import('./mcp/handlers/index.js').then(async ({ handlers }) => {
  const r = await handlers.list_custom_page_examples();
  console.log(JSON.stringify(r, null, 2));
});
"
```

Should print the list of examples.

## Why one CLI, two front-ends

Both the human-facing `bonita-page` CLI (used by clients without IA, see [`../README.md`](../README.md)) and the MCP handlers call the **same** functions in `scripts/{scaffold,wrap,validate,build}.js`. There's a single source of truth for behaviour, so a fix in either flow propagates to both.

When you (or a contributor) change CLI behaviour, the MCP tool inherits the change automatically — no parallel maintenance.
