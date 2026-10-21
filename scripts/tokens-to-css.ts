/**
 * Reads `src/design/tokens.ts` (the typed source of truth) and writes
 * `src/app/tokens.css`: CSS custom properties for `:root` (app light theme),
 * `.staff` (Guard/Creche dark theme) and `.shell` (presentation stage).
 * Run via `predev` / `prebuild` (package.json), or `pnpm tokens:css`.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  appColor,
  overlayColor,
  emberColor,
  sosColor,
  browserChrome,
  skeletonColor,
  staffColor,
  shellColor,
  shadow,
  spacingScale,
  layout,
  radius,
  borderWidth,
  touchTarget,
  deviceFrame,
  appType,
  shellType,
  type TypeStyle,
} from '../src/design/tokens';

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function colorVars(obj: Record<string, string>, prefix = ''): string[] {
  return Object.entries(obj).map(([key, value]) => `  --${prefix}${kebab(key)}: ${value};`);
}

function pxVars(obj: Record<string, number>, prefix = '', unit = 'px'): string[] {
  return Object.entries(obj).map(([key, value]) => `  --${prefix}${kebab(key)}: ${value}${unit};`);
}

/** Tailwind v4 `--text-*` utility: size, line-height, letter-spacing and weight bundled together. */
function typeVars(names: Record<string, string>, styles: Record<string, TypeStyle>): string[] {
  return Object.entries(names).flatMap(([key, cssName]) => {
    const s = styles[key];
    if (!s) return [];
    const lines = [
      `  --text-${cssName}: ${(s.sizePx / 16).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}rem;`,
      `  --text-${cssName}--line-height: ${(s.lineHeightPx / 16)
        .toFixed(4)
        .replace(/0+$/, '')
        .replace(/\.$/, '')}rem;`,
      `  --text-${cssName}--font-weight: ${s.weight};`,
    ];
    if (s.trackingEm) {
      lines.push(`  --text-${cssName}--letter-spacing: ${s.trackingEm}em;`);
    }
    return lines;
  });
}

const appTypeNames: Record<keyof typeof appType, string> = {
  titleL: 'title-l',
  label1: 'label-1',
  label2: 'label-2',
  label3: 'label-3',
  body2: 'body-2',
  body3: 'body-3',
  button: 'button',
  tag: 'tag',
  display: 'display',
  scriptAccent: 'script-accent',
  serifHero: 'serif-hero',
  serifTitle: 'serif-title',
  serifSection: 'serif-section',
  serifNumeral: 'serif-numeral',
  eyebrow: 'eyebrow',
};

const shellTypeNames: Record<keyof typeof shellType, string> = {
  label: 'shell-label',
  heading: 'shell-heading',
  number: 'shell-number',
  body: 'shell-body',
};

const rootLines: string[] = [
  ':root {',
  '  /* App colour tokens — PRD §5.2 */',
  ...colorVars(appColor),
  ...colorVars(overlayColor),
  ...colorVars(emberColor),
  `  --sos: ${sosColor};`,
  `  --browser-chrome-frame: ${browserChrome.frame};`,
  `  --browser-chrome-toolbar: ${browserChrome.toolbar};`,
  `  --skeleton-base: ${skeletonColor.base};`,
  `  --skeleton-highlight: ${skeletonColor.highlight};`,
  '',
  '  /* Shadows — PRD §5.2 */',
  `  --shadow-bar: ${shadow.bar};`,
  `  --shadow-card-hover: ${shadow.cardHover};`,
  '',
  '  /* Shape, spacing and layout — PRD §5.6 */',
  ...pxVars(layout),
  ...pxVars(radius, 'radius-'),
  `  --border-card-width: ${borderWidth.card}px;`,
  ...pxVars(touchTarget, 'touch-'),
  ...spacingScale.map((value, i) => `  --space-${i + 1}: ${value}px;`),
  '',
  '  /* Device frames — PRD §4.1/§4.2 */',
  `  --frame-phone-w: ${deviceFrame.phone.width}px;`,
  `  --frame-phone-h: ${deviceFrame.phone.height}px;`,
  `  --frame-tablet-w: ${deviceFrame.tablet.width}px;`,
  `  --frame-tablet-h: ${deviceFrame.tablet.height}px;`,
  `  --frame-browser-w: ${deviceFrame.browser.width}px;`,
  `  --frame-browser-h: ${deviceFrame.browser.height}px;`,
  '}',
];

// Typography lives in its own @theme block (not :root) so Tailwind v4 turns
// each --text-* entry into a `text-*` utility (PRD §5.5).
const typeThemeLines: string[] = [
  '',
  '/* Typography — PRD §5.5. @theme so Tailwind generates text-* utilities. */',
  '@theme {',
  ...typeVars(appTypeNames, appType),
  ...typeVars(shellTypeNames, shellType),
  '}',
];

const staffLines: string[] = [
  '',
  '/* Staff theme (Guard, Creche) — PRD §5.3. Scoped by .staff on the device root. */',
  '.staff {',
  `  --bg-page: ${staffColor.bg};`,
  `  --surface: ${staffColor.surface};`,
  `  --border-card: ${staffColor.border};`,
  `  --text-title: ${staffColor.textPrimary};`,
  `  --text-body: ${staffColor.textPrimary};`,
  `  --text-muted: ${staffColor.textMuted};`,
  `  --text-placeholder: ${staffColor.textMuted};`,
  `  --brand: ${staffColor.brand};`,
  `  --brand-tint: ${staffColor.brandTint};`,
  `  --on-brand: ${staffColor.onBrand};`,
  `  --success: ${staffColor.success};`,
  `  --warning: ${staffColor.warning};`,
  `  --danger: ${staffColor.danger};`,
  `  --info: ${staffColor.info};`,
  `  --maintenance: ${staffColor.maintenance};`,
  '}',
];

const shellLines: string[] = [
  '',
  '/* Shell (presentation stage) tokens — PRD §5.4. Scoped to .shell. */',
  '.shell {',
  ...colorVars(shellColor, 'shell-'),
  '}',
];

const header = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' * Source: src/design/tokens.ts. Regenerate with `pnpm tokens:css`.',
  ' */',
  '',
].join('\n');

const css = [
  header,
  rootLines.join('\n'),
  staffLines.join('\n'),
  shellLines.join('\n'),
  typeThemeLines.join('\n'),
  '',
].join('\n');

const outPath = resolve(import.meta.dirname, '../src/app/tokens.css');
writeFileSync(outPath, css, 'utf8');

console.log(`[tokens-to-css] wrote ${outPath}`);
