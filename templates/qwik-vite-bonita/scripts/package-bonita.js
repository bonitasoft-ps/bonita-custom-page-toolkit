import { createWriteStream, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import archiver from 'archiver';

const DIST_DIR = process.env.DIST_DIR || 'dist';
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'dist/page-__NAME__.zip';
const PAGE_PROPERTIES = 'page.properties';

if (!existsSync(PAGE_PROPERTIES)) {
  console.error(`Missing ${PAGE_PROPERTIES} at project root`);
  process.exit(1);
}
if (!existsSync(DIST_DIR) || !existsSync(join(DIST_DIR, 'index.html'))) {
  console.error(`Build output missing: ${DIST_DIR}/index.html`);
  console.error('Did you run "npm run build" first?');
  process.exit(1);
}

function addDirToArchive(archive, dirPath, archivePath) {
  for (const entry of readdirSync(dirPath)) {
    if (entry.endsWith('.zip')) continue;
    if (entry === 'page.properties') continue;
    const fullPath = join(dirPath, entry);
    const entryArchivePath = archivePath ? `${archivePath}/${entry}` : entry;
    if (statSync(fullPath).isDirectory()) {
      addDirToArchive(archive, fullPath, entryArchivePath);
    } else {
      archive.file(fullPath, { name: entryArchivePath });
    }
  }
}

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
