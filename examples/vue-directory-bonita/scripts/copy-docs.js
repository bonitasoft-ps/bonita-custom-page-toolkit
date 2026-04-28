// Copy deployment docs alongside the ZIP in dist/.
// These are reference files for whoever receives the ZIP — they are NOT
// included in the ZIP itself (Bonita only needs page.properties + resources/).

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const SOURCES = [
  ['docs/DEPLOY-README.md',   'DEPLOY-README.md'],
  ['docs/DEPLOY-README.html', 'DEPLOY-README.html'],
];

if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}

let copied = 0;
for (const [src, name] of SOURCES) {
  if (!existsSync(src)) {
    console.warn(`(skipped, missing) ${src}`);
    continue;
  }
  const dest = join(DIST_DIR, name);
  copyFileSync(src, dest);
  console.log(`Copied ${src} → ${dest}`);
  copied++;
}

console.log(`Docs copied: ${copied}`);
