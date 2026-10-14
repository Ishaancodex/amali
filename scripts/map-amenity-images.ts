/**
 * Maps files in `public/amenities/` to amenity keys and renames them to
 * `<key>.<ext>` (PRD §5.8, TRD §11). Files that don't match any keyword, or
 * keys with no matching file, are reported — unmatched amenities fall back
 * to the gradient placeholder at render time.
 */
import { readdirSync, renameSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import type { AmenityKey } from '../src/types/amenity';

const DIR = resolve(import.meta.dirname, '../public/amenities');

const KEYWORDS: Record<AmenityKey, RegExp> = {
  padel: /padel/i,
  screening: /screen|cinema/i,
  music: /music/i,
  creche: /creche|kid|play/i,
  dining: /dining|restaurant|teppan/i,
  pool: /pool/i,
  gym: /gym/i,
};

function matchKey(filename: string): AmenityKey | null {
  for (const [key, re] of Object.entries(KEYWORDS) as [AmenityKey, RegExp][]) {
    if (re.test(filename)) return key;
  }
  return null;
}

function main(): void {
  if (!existsSync(DIR)) {
    console.error(`[map-amenity-images] directory not found: ${DIR}`);
    process.exitCode = 1;
    return;
  }

  const files = readdirSync(DIR).filter((f) => !f.startsWith('.'));
  const matched = new Map<AmenityKey, string>();
  const unmatchedFiles: string[] = [];

  for (const file of files) {
    const key = matchKey(file);
    if (!key) {
      unmatchedFiles.push(file);
      continue;
    }
    if (matched.has(key)) {
      console.warn(
        `[map-amenity-images] multiple files match "${key}" — keeping "${matched.get(key)}", skipping "${file}"`,
      );
      continue;
    }
    matched.set(key, file);
  }

  const allKeys: AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining', 'pool', 'gym'];
  const rows: { key: AmenityKey; from: string | null; to: string }[] = [];

  for (const key of allKeys) {
    const from = matched.get(key);
    const to = `${key}${from ? extname(from) : ''}`;
    if (from && from !== to) {
      renameSync(resolve(DIR, from), resolve(DIR, to));
    }
    rows.push({ key, from: from ?? null, to: from ? to : '(missing — placeholder gradient used)' });
  }

  console.log('\n[map-amenity-images] amenity → file');
  console.table(rows);

  const gaps = rows.filter((r) => !r.from);
  for (const gap of gaps) {
    console.warn(`[map-amenity-images] no image found for "${gap.key}" — using the gradient placeholder.`);
  }
  for (const file of unmatchedFiles) {
    console.warn(`[map-amenity-images] "${file}" didn't match any amenity key — left as-is.`);
  }
}

main();
