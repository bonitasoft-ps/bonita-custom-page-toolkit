# ZIP packaging — universal script

The same Node.js script works for React, Vue and Angular. Only the input directory changes (Vite outputs to `dist/`, Angular outputs to `dist/<project>/browser/`).

## Required ZIP layout

```
page-{name}.zip
├── page.properties        ← AT ZIP ROOT
└── resources/             ← MUST be named "resources"
    ├── index.html
    ├── favicon.svg
    └── assets/
        ├── index-{hash}.js
        ├── index-{hash}.css
        └── ...
```

Common mistakes:
- Wrapping everything inside an extra `my-app/` folder
- Naming the assets folder `static/` or `dist/` instead of `resources/`
- Putting `page.properties` inside `resources/`

## Universal script — `scripts/package-bonita.js`

```javascript
import { createWriteStream, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import archiver from 'archiver';

// ── Configuration ───────────────────────────────────────────────
// Adjust DIST_DIR to match your framework's build output
const DIST_DIR = process.env.DIST_DIR || 'dist';
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'dist/page-app.zip';
const PAGE_PROPERTIES = 'page.properties';

// ── Validation ──────────────────────────────────────────────────
if (!existsSync(PAGE_PROPERTIES)) {
  console.error(`Missing ${PAGE_PROPERTIES} at project root`);
  process.exit(1);
}
if (!existsSync(DIST_DIR) || !existsSync(join(DIST_DIR, 'index.html'))) {
  console.error(`Build output missing: ${DIST_DIR}/index.html`);
  console.error('Did you run "npm run build" first?');
  process.exit(1);
}

// ── Recursive directory archiver ────────────────────────────────
function addDirToArchive(archive, dirPath, archivePath) {
  for (const entry of readdirSync(dirPath)) {
    if (entry.endsWith('.zip')) continue;        // Skip self
    if (entry === 'page.properties') continue;   // Skip if accidentally in dist
    const fullPath = join(dirPath, entry);
    const entryArchivePath = archivePath ? `${archivePath}/${entry}` : entry;
    if (statSync(fullPath).isDirectory()) {
      addDirToArchive(archive, fullPath, entryArchivePath);
    } else {
      archive.file(fullPath, { name: entryArchivePath });
    }
  }
}

// ── Main ────────────────────────────────────────────────────────
async function packageBonita() {
  console.log(`Packaging ${DIST_DIR} → ${OUTPUT_FILE}`);
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);

  archive.file(PAGE_PROPERTIES, { name: 'page.properties' });
  addDirToArchive(archive, DIST_DIR, 'resources');

  await archive.finalize();
  console.log(`Done: ${OUTPUT_FILE} (${archive.pointer()} bytes)`);
}

packageBonita().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
```

## package.json wiring

### React / Vue (Vite)

```json
{
  "type": "module",
  "scripts": {
    "build": "vite build",
    "build:bonita": "vite build && node scripts/package-bonita.js"
  },
  "devDependencies": {
    "archiver": "^7.0.0"
  }
}
```

### Angular

Angular emits to `dist/<project>/browser/`. Set the env var:

```json
{
  "type": "module",
  "scripts": {
    "build": "ng build --configuration=production",
    "build:bonita": "ng build --configuration=production && cross-env DIST_DIR=dist/my-app/browser node scripts/package-bonita.js"
  },
  "devDependencies": {
    "archiver": "^7.0.0",
    "cross-env": "^7.0.3"
  }
}
```

(On non-Windows machines you can omit `cross-env` and write `DIST_DIR=... node scripts/...`)

## Why a script and not just `zip -r`?

A bash `zip -r` invocation works but is fragile across OSes (Windows lacks `zip` by default, and PowerShell's `Compress-Archive` produces a structure Bonita rejects). The Node script:

- Runs identically on Windows, macOS and Linux
- Excludes self-references (the previous ZIP) and stray files
- Validates the build output before zipping
- Uses maximum compression
- Reports the final size

## Verifying the ZIP locally

After `npm run build:bonita`, inspect the ZIP:

```bash
# Windows (PowerShell)
Get-ChildItem -Path .\dist\page-app.zip
Expand-Archive -Path .\dist\page-app.zip -DestinationPath .\dist\verify -Force
Get-ChildItem -Recurse .\dist\verify

# macOS/Linux
unzip -l dist/page-app.zip
```

The output should show:
```
page.properties
resources/index.html
resources/assets/index-XXXXX.js
resources/assets/index-XXXXX.css
```

If `page.properties` is missing or under `resources/`, the build won't deploy correctly.

## Filename convention

Use `page-{name}.zip` so the file matches `page.properties.name` (without the `custompage_` prefix). Examples:

| `page.properties.name` | ZIP filename |
|------------------------|--------------|
| `custompage_taskViewer` | `page-taskViewer.zip` |
| `custompage_invoiceForm` | `page-invoiceForm.zip` |

Bonita doesn't care about the ZIP filename — it reads the name from `page.properties`. The filename is only for human convenience.
