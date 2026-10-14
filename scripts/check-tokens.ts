/**
 * Fails the build if a raw hex colour (or `rgb(`/`rgba(`) appears outside
 * `src/design/` and the generated `src/app/tokens.css` (TRD §9.1).
 * Run via `prebuild`, or `pnpm check:tokens`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');

const ALLOWED_PREFIXES = ['src/design/', 'src/app/tokens.css'];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\brgba?\(/g;

const candidates = globSync('src/**/*.{ts,tsx,css}', { cwd: ROOT }).filter(
  (p: string) => !ALLOWED_PREFIXES.some((prefix) => p.startsWith(prefix)),
);

let violations = 0;

for (const relPath of candidates) {
  const fullPath = resolve(ROOT, relPath);
  const text = readFileSync(fullPath, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const hexMatches = line.match(HEX_RE);
    const rgbMatches = line.match(RGB_RE);
    if (hexMatches || rgbMatches) {
      violations += 1;
      console.error(`[check-tokens] ${relPath}:${i + 1}: raw colour value — ${line.trim()}`);
    }
  });
}

if (violations > 0) {
  console.error(
    `\n[check-tokens] ${violations} raw colour value(s) found outside src/design/. Use design/tokens.ts instead.`,
  );
  process.exit(1);
}

console.log('[check-tokens] no raw colour values found outside src/design/.');
