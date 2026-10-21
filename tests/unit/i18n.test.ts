import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '@/i18n/en.json';
import ar from '@/i18n/ar.json';

type Tree = { [k: string]: string | Tree };
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'string' ? { ...out, [key]: v } : { ...out, ...flatten(v, key) };
  }, {});
}

const AR_PLURALS = ['zero', 'one', 'two', 'few', 'many', 'other'];
const enFlat = flatten(en as Tree);
const arFlat = flatten(ar as Tree);
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
const placeholders = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe('i18n catalogues (PRD §14)', () => {
  it('every English key has an Arabic value, and Arabic has no extra keys', () => {
    const enBases = new Set(Object.keys(enFlat).map(base));
    const arBases = new Set(Object.keys(arFlat).map(base));
    expect([...enBases].filter((k) => !arBases.has(k))).toEqual([]);
    expect([...arBases].filter((k) => !enBases.has(k))).toEqual([]);
    expect(Object.entries(arFlat).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it('Arabic plurals have all six forms', () => {
    const plural = new Set(
      Object.keys(enFlat)
        .filter((k) => k.endsWith('_other'))
        .map(base),
    );
    const missing = [...plural].flatMap((k) =>
      AR_PLURALS.filter((f) => !(`${k}_${f}` in arFlat)).map((f) => `${k}_${f}`),
    );
    expect(missing).toEqual([]);
  });

  it('Arabic uses the same placeholders as English (a plural form may drop {{count}})', () => {
    const bad = Object.entries(enFlat).flatMap(([k, v]) => {
      const want = placeholders(v).filter((p) => p !== 'count');
      const forms =
        k.endsWith('_other') || k.endsWith('_one') ? AR_PLURALS.map((f) => `${base(k)}_${f}`) : [k];
      return forms
        .filter((f) => f in arFlat)
        .filter(
          (f) =>
            placeholders(arFlat[f]!)
              .filter((p) => p !== 'count')
              .join() !== want.join(),
        )
        .map((f) => `${f}: ${arFlat[f]}`);
    });
    expect(bad).toEqual([]);
  });
});

/** Every .tsx under a directory. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('no hard-coded copy on device screens (CLAUDE.md: every string is a key)', () => {
  // The demo shell (src/shell) stays English by design (PRD §14); devices must not.
  const files = ['src/surfaces', 'src/ui', 'src/features', 'src/navigation', 'src/i18n'].flatMap(
    tsxFiles,
  );
  // Text between a tag's `>` and the next tag (`</x` or `<X`), on one line…
  const JSX_TEXT = /[\w"'}]>\s*([^<>{}=&()\n]*[A-Za-z]{2,}[^<>{}=&()\n]*?)\s*<\/?[A-Za-z]/;
  // …or a line that is nothing but words (JSX text wrapped onto its own line).
  const TEXT_LINE = /^[A-Z][a-z]+(?: [A-Za-z'’!?&;-]+)*[.!?]?$/;
  const LITERAL_PROP =
    /\b(?:label|title|placeholder|message|aria-label|alt)="([^"]*[A-Za-z][^"]*)"/;

  it.each(files)('%s', (file) => {
    const offenders = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => !/^(\/\/|\*|\/\*)/.test(line))
      .filter(({ line }) => JSX_TEXT.test(line) || TEXT_LINE.test(line) || LITERAL_PROP.test(line))
      .map(({ line, n }) => `${n}: ${line}`);
    expect(offenders).toEqual([]);
  });
});
