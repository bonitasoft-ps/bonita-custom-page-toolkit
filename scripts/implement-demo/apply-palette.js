// Patch a project's tokens.css (or insert one) with palette values from the
// spec. Stays minimal — only touches CSS custom properties, leaves other
// declarations alone.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const DEFAULT_PALETTE = {
  primary: '#1a2e5a',
  secondary: '#243870',
  accent: '#0e9fa8',
};

export function applyPalette(projectDir, palette = {}) {
  const merged = { ...DEFAULT_PALETTE, ...palette };
  const tokensFile = join(projectDir, 'src', 'styles', 'tokens.css');
  const block = `:root {
  --navy:   ${merged.primary};
  --navy2:  ${merged.secondary};
  --teal:   ${merged.accent};
  --bg:     #f1f4f9;
  --white:  #ffffff;
  --text:   #1e2840;
  --muted:  #6b7a99;
  --border: #dde3ef;
}
`;
  mkdirSync(dirname(tokensFile), { recursive: true });
  if (!existsSync(tokensFile)) {
    writeFileSync(tokensFile, block);
    return { file: tokensFile, action: 'created' };
  }
  // Already exists — replace the :root block if present, otherwise prepend.
  const current = readFileSync(tokensFile, 'utf8');
  const replaced = current.replace(/:root\s*\{[^}]*\}\s*/m, '');
  writeFileSync(tokensFile, block + replaced);
  return { file: tokensFile, action: 'merged' };
}
