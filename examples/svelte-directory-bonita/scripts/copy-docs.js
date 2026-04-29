import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const SOURCES = [
  ['docs/DEPLOY-README.md', 'DEPLOY-README.md'],
  ['docs/DEPLOY-README.html', 'DEPLOY-README.html'],
];

if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

let copied = 0;
for (const [src, name] of SOURCES) {
  if (!existsSync(src)) {
    console.warn(`(skipped, missing) ${src}`);
    continue;
  }
  copyFileSync(src, join(DIST_DIR, name));
  console.log(`Copied ${src} → ${join(DIST_DIR, name)}`);
  copied++;
}
console.log(`Docs copied: ${copied}`);
