// Validate a Bonita custom-page ZIP structure.
// Bonita requires:
//   - page.properties at the ZIP root, with a `name=` line starting with "custompage_"
//   - resources/ directory with index.html inside

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function loadYauzl() {
  // yauzl is a tiny pure-JS unzip reader. Optional dep — fall back to error
  // if it's not installed (the project may run validate without yauzl).
  try {
    return await import('yauzl');
  } catch {
    return null;
  }
}

export async function validate(zipPath) {
  if (!existsSync(zipPath)) {
    return { valid: false, error: `File not found: ${zipPath}` };
  }

  const yauzl = await loadYauzl();
  if (!yauzl) {
    return {
      valid: null,
      error: 'yauzl is not installed. Run: npm install yauzl',
    };
  }

  return new Promise((resolve) => {
    yauzl.default.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        resolve({ valid: false, error: `Cannot open ZIP: ${err.message}` });
        return;
      }

      const entries = [];
      let pagePropertiesContent = null;
      let hasPagePropertiesAtRoot = false;
      let hasResourcesDir = false;
      let hasIndexHtml = false;

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        entries.push(entry.fileName);

        if (entry.fileName === 'page.properties') {
          hasPagePropertiesAtRoot = true;
          // Read its content
          zipfile.openReadStream(entry, (err, stream) => {
            if (err) {
              zipfile.readEntry();
              return;
            }
            const chunks = [];
            stream.on('data', (c) => chunks.push(c));
            stream.on('end', () => {
              pagePropertiesContent = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
          });
          return;
        }

        if (entry.fileName.startsWith('resources/')) {
          hasResourcesDir = true;
          if (entry.fileName === 'resources/index.html') {
            hasIndexHtml = true;
          }
        }

        zipfile.readEntry();
      });

      zipfile.on('end', () => {
        const issues = [];

        if (!hasPagePropertiesAtRoot) {
          issues.push('page.properties is NOT at the ZIP root (Bonita requires it there).');
        }
        if (!hasResourcesDir) {
          issues.push('resources/ directory is missing (Bonita serves files from there).');
        }
        if (!hasIndexHtml) {
          issues.push('resources/index.html is missing.');
        }

        const props = pagePropertiesContent ? parseProperties(pagePropertiesContent) : {};
        if (props.name && !props.name.startsWith('custompage_')) {
          issues.push(`page.properties: name="${props.name}" must start with "custompage_".`);
        }
        if (!props.name) {
          issues.push('page.properties: name= line missing or empty.');
        }
        if (!props.contentType) {
          issues.push('page.properties: contentType= line missing.');
        }

        resolve({
          valid: issues.length === 0,
          name: props.name,
          displayName: props.displayName,
          contentType: props.contentType,
          fileCount: entries.length,
          issues,
        });
      });

      zipfile.on('error', (e) => {
        resolve({ valid: false, error: e.message });
      });
    });
  });
}

function parseProperties(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}
