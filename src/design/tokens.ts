/**
 * Design tokens — the single typed source of truth (PRD §5, §13).
 * Never hardcode a colour, radius, font size, duration or easing in a component.
 * `scripts/tokens-to-css.ts` reads this file and writes `src/app/tokens.css`.
 */

// ---------------------------------------------------------------------------
// Colour — app (light theme), PRD §5.2
// ---------------------------------------------------------------------------

/**
 * Brand palette, aligned to `documents/Amali Properties_Brand Guidelines.pdf`
 * (base palette: Amali Sand #BE7E63, Pearl #F1ECE2, Stone #57585B, Ember
 * #000000 — sampled directly from the brand book's colour-swatch page).
 *
 * P11 accessibility pass (WCAG AA, axe "zero serious"): on the light theme
 * the brand-book Sand is 2.8:1 on Pearl and 3.3:1 under white text, and the
 * status colours were 2–4:1 on their own tints. Each is darkened along its
 * own hue just enough to reach 4.5:1 on every surface it's used on — the
 * brand-book value is noted beside it. The staff (dark) theme keeps Sand.
 */
export const appColor = {
  brand: '#985A3F', // Amali Sand, AA shade (brand book #BE7E63)
  brandTint: '#F1ECE2', // Amali Pearl
  onBrand: '#FFFFFF',
  textTitle: '#57585B', // Amali Stone
  textBody: '#31383C',
  textMuted: '#616B70', // was #6F7A80
  textPlaceholder: '#6E6E6E', // was #868686
  borderCard: '#E2DDDB',
  surface: '#FFFFFF',
  bgPage: '#F7F4F0',
  success: '#0F6E4B', // was #19B27A
  warning: '#81591E', // was #C98A2E
  danger: '#AC3527', // was #D2493A
  info: '#41657A', // was #4F7A94
  maintenance: '#686056', // was #8A7F72
} as const;

/** SOS: one flat red (white text on it is 5.1:1). */
export const sosColor = '#D2382A';

/** Browser device-frame window chrome (PRD §4.1 "Browser: ... window chrome"). */
export const browserChrome = {
  frame: '#E8E6E1',
  toolbar: '#F3F1EC',
} as const;

/** Skeleton shimmer (PRD §5.7: "warm grey #EFEAE4 with a shimmer"). */
export const skeletonColor = {
  base: '#EFEAE4',
  highlight: '#F5F1EC',
} as const;

// ---------------------------------------------------------------------------
// Colour — ember surfaces (resident header bands, tab bar, ticket stub)
// ---------------------------------------------------------------------------

/**
 * The dark half of the resident app (`documents/competitor-reference-review.md`):
 * header bands, the floating tab bar and the ticket stub sit on Ember, with the
 * brand-book Sand (#BE7E63, 5.6:1 on Ember) as the one accent. Text on Ember
 * is Pearl; muted text is a warm grey that clears 4.5:1.
 */
export const emberColor = {
  ember: '#0E0D0C',
  emberRaised: '#22201D',
  onEmber: '#F2EDE3',
  onEmberMuted: '#B9B2A6',
  sandOnEmber: '#BE7E63',
  sandSoft: '#DFBFB0',
  emberHairline: 'rgba(242,237,227,0.13)',
  emberGlass: 'rgba(14,13,12,0.88)',
  pearlGlass: 'rgba(247,244,240,0.82)',
  /** Flat darkening laid over a photo behind a title, so text stays legible without a gradient. */
  emberVeil: 'rgba(14,13,12,0.6)',
} as const;

// ---------------------------------------------------------------------------
// Colour — staff theme (Guard, Creche), PRD §5.3
// ---------------------------------------------------------------------------

export const staffColor = {
  bg: '#14130F',
  surface: '#1F1E1A',
  border: '#2F2D2A',
  textPrimary: '#F5F1E8',
  textMuted: '#A3A09A',
  brand: '#BE7E63', // Amali Sand — 5.6:1 on the dark background
  // P11 accessibility pass: the light theme's tint, on-brand and status shades are tuned for
  // light surfaces; on dark ones they need their own (each ≥ 4.5:1 on the surface and its tint).
  brandTint: '#251E17',
  onBrand: '#14130F',
  success: '#19B27A',
  warning: '#CC8C2F',
  danger: '#DF7D72',
  info: '#779EB6',
  maintenance: '#A1988D',
} as const;

/**
 * Overlays inside a device (P11): toasts, island notifications and the sheet
 * scrim — a dark card in the stage's colours on any theme. They used the
 * `shell-*` tokens before, which are only defined under a `.shell` scope
 * that Tailwind's @theme folding can't see (the P1 footgun), so they
 * rendered transparent. These live on :root, where folding works.
 */
export const overlayColor = {
  overlay: '#1C1B18',
  onOverlay: '#F5F1E8',
  onOverlayMuted: '#B2AA9A',
  scrim: '#0E0D0B',
} as const;

// ---------------------------------------------------------------------------
// Colour — shell (presentation stage), PRD §5.4
// ---------------------------------------------------------------------------

export const shellColor = {
  stage: '#0E0D0B',
  stageRaised: '#1C1B18',
  stageBorder: '#3C3C39',
  stageRule: '#2F2D2A',
  stageActive: '#F5F1E8',
  stageActiveText: '#14130F',
  stageText: '#A3A09A',
  notesLabel: '#948C7E',
  notesNumber: '#737B80',
  notesBody: '#B2AA9A',
} as const;

// ---------------------------------------------------------------------------
// Shadows, PRD §5.2
// ---------------------------------------------------------------------------

export const shadow = {
  bar: [
    '0 0 0 rgba(49,42,29,0.05)',
    '0 -1px 0 rgba(49,42,29,0.05)',
    '0 -4px 4px rgba(49,42,29,0.04)',
    '0 -9px 9px rgba(49,42,29,0.03)',
    '0 -17px 17px rgba(49,42,29,0.01)',
    '0 -26px 26px rgba(49,42,29,0)',
  ].join(', '),
  cardHover: '4px 4px 10px rgba(174,105,85,0.16)',
} as const;

// ---------------------------------------------------------------------------
// Typography, PRD §5.5
// ---------------------------------------------------------------------------

/**
 * `font` is a role, not a literal font name, so the brand's two typefaces
 * (primary/secondary) stay swappable in one place — see `design/fonts.ts`.
 * `primary` = Aviano Sans (via Poppins), `secondary` = DIN 2014 (via
 * Barlow), `script` = the "Romantically" accent (via Alex Brush), reserved
 * for the one decorative, non-functional moment that calls for it.
 *
 * Casing is not a token: the `eyebrow` role is uppercased by `ui/Eyebrow`
 * (and left alone in Arabic).
 */
export interface TypeStyle {
  font: 'primary' | 'secondary' | 'script' | 'serif' | 'wide';
  sizePx: number;
  lineHeightPx: number;
  weight: number;
  trackingEm?: number;
}

export const appType: Record<
  | 'titleL'
  | 'label1'
  | 'label2'
  | 'label3'
  | 'body2'
  | 'body3'
  | 'button'
  | 'tag'
  | 'display'
  | 'scriptAccent'
  | 'serifHero'
  | 'serifTitle'
  | 'serifSection'
  | 'serifNumeral'
  | 'eyebrow',
  TypeStyle
> = {
  titleL: { font: 'primary', sizePx: 20, lineHeightPx: 24, weight: 500 },
  label1: { font: 'primary', sizePx: 16, lineHeightPx: 20, weight: 500 },
  label2: { font: 'primary', sizePx: 14, lineHeightPx: 18, weight: 500 },
  label3: { font: 'primary', sizePx: 12, lineHeightPx: 16, weight: 500 },
  body2: { font: 'primary', sizePx: 14, lineHeightPx: 20, weight: 400 },
  body3: { font: 'primary', sizePx: 12, lineHeightPx: 16, weight: 400 },
  button: { font: 'primary', sizePx: 16, lineHeightPx: 20, weight: 700 },
  tag: { font: 'secondary', sizePx: 12, lineHeightPx: 16, weight: 400, trackingEm: 0.02 },
  display: { font: 'primary', sizePx: 28, lineHeightPx: 34, weight: 500 },
  scriptAccent: { font: 'script', sizePx: 36, lineHeightPx: 40, weight: 400 },
  // Resident header/section type: Instrument Serif italic for titles and big numerals,
  // Julius Sans One caps for eyebrows (10px is the floor that stays legible and passes axe).
  serifHero: { font: 'serif', sizePx: 44, lineHeightPx: 44, weight: 400 },
  serifTitle: { font: 'serif', sizePx: 28, lineHeightPx: 30, weight: 400 },
  serifSection: { font: 'serif', sizePx: 24, lineHeightPx: 26, weight: 400 },
  serifNumeral: { font: 'serif', sizePx: 40, lineHeightPx: 40, weight: 400 },
  eyebrow: { font: 'wide', sizePx: 10, lineHeightPx: 16, weight: 400, trackingEm: 0.26 },
};

export const shellType: Record<'label' | 'heading' | 'number' | 'body', TypeStyle> = {
  label: { font: 'secondary', sizePx: 13, lineHeightPx: 16, weight: 400, trackingEm: 0.24 },
  heading: { font: 'primary', sizePx: 40, lineHeightPx: 48, weight: 400 },
  number: { font: 'primary', sizePx: 44, lineHeightPx: 48, weight: 500 },
  body: { font: 'primary', sizePx: 20, lineHeightPx: 34, weight: 400 },
};

// ---------------------------------------------------------------------------
// Shape, spacing and layout, PRD §5.6
// ---------------------------------------------------------------------------

export const spacingScale = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48] as const;

export const layout = {
  pagePadding: 16,
  cardPadding: 12,
  cardGap: 16,
  /** Floating tab bar (`ui/BottomNav`): its height, and the scroll inset that clears it. */
  navHeight: 66,
  navInset: 104,
} as const;

export const radius = {
  card: 12,
  cardImage: 8,
  input: 8,
  button: 4,
  tag: 16,
  bottomSheetTop: 20,
  /** Pearl body sheet overlapping a header band, and tickets. */
  sheet: 26,
  tile: 20,
  nav: 24,
} as const;

export const borderWidth = {
  card: 0.5,
} as const;

export const touchTarget = {
  resident: 44,
  staff: 56,
} as const;

// ---------------------------------------------------------------------------
// Device frames, PRD §4.1 / §4.2
// ---------------------------------------------------------------------------

export const deviceFrame = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1180, height: 820 },
  browser: { width: 1440, height: 900 },
} as const;

export type DeviceKind = keyof typeof deviceFrame;

// ---------------------------------------------------------------------------
// F&B timeline geometry, PRD §8.4 (tables × 15-minute columns, CSS px)
// ---------------------------------------------------------------------------

export const fnbTimeline = {
  colWidth: 44,
  rowHeight: 44,
  labelWidth: 76,
  blockInset: 4,
} as const;
