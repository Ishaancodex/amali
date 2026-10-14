/**
 * Design tokens — the single typed source of truth (PRD §5, §13).
 * Never hardcode a colour, radius, font size, duration or easing in a component.
 * `scripts/tokens-to-css.ts` reads this file and writes `src/app/tokens.css`.
 */

// ---------------------------------------------------------------------------
// Colour — app (light theme), PRD §5.2
// ---------------------------------------------------------------------------

export const appColor = {
  brand: '#B29368',
  brandTint: '#FFFBF4',
  onBrand: '#FFFFFF',
  textTitle: '#51575E',
  textBody: '#31383C',
  textMuted: '#6F7A80',
  textPlaceholder: '#868686',
  borderCard: '#E2DDDB',
  surface: '#FFFFFF',
  bgPage: '#F7F4F0',
  success: '#19B27A',
  warning: '#C98A2E',
  danger: '#D2493A',
  info: '#4F7A94',
  maintenance: '#8A7F72',
} as const;

export const sosGradient = {
  from: '#E8572B',
  to: '#D2382A',
} as const;

/** Browser device-frame window chrome (PRD §4.1 "Browser: ... window chrome"). */
export const browserChrome = {
  frame: '#E8E6E1',
  toolbar: '#F3F1EC',
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
  brand: '#B29368',
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

export interface TypeStyle {
  font: 'manrope' | 'ppNeueMontreal' | 'jost';
  sizePx: number;
  lineHeightPx: number;
  weight: number;
  trackingEm?: number;
  transform?: 'none' | 'uppercase';
}

export const appType: Record<
  'titleL' | 'label1' | 'label2' | 'label3' | 'body2' | 'body3' | 'button' | 'tag' | 'display',
  TypeStyle
> = {
  titleL: { font: 'manrope', sizePx: 20, lineHeightPx: 24, weight: 500 },
  label1: { font: 'manrope', sizePx: 16, lineHeightPx: 20, weight: 500 },
  label2: { font: 'manrope', sizePx: 14, lineHeightPx: 18, weight: 500 },
  label3: { font: 'manrope', sizePx: 12, lineHeightPx: 16, weight: 500 },
  body2: { font: 'manrope', sizePx: 14, lineHeightPx: 20, weight: 400 },
  body3: { font: 'manrope', sizePx: 12, lineHeightPx: 16, weight: 400 },
  button: { font: 'manrope', sizePx: 16, lineHeightPx: 20, weight: 700 },
  tag: { font: 'ppNeueMontreal', sizePx: 12, lineHeightPx: 16, weight: 400, trackingEm: 0.02 },
  display: { font: 'manrope', sizePx: 28, lineHeightPx: 34, weight: 500 },
};

export const shellType: Record<'label' | 'heading' | 'number' | 'body', TypeStyle> = {
  label: {
    font: 'ppNeueMontreal',
    sizePx: 13,
    lineHeightPx: 16,
    weight: 400,
    trackingEm: 0.24,
    transform: 'uppercase',
  },
  heading: { font: 'jost', sizePx: 40, lineHeightPx: 48, weight: 400 },
  number: { font: 'jost', sizePx: 44, lineHeightPx: 48, weight: 500 },
  body: { font: 'jost', sizePx: 20, lineHeightPx: 34, weight: 400 },
};

// ---------------------------------------------------------------------------
// Shape, spacing and layout, PRD §5.6
// ---------------------------------------------------------------------------

export const spacingScale = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48] as const;

export const layout = {
  pagePadding: 16,
  cardPadding: 12,
  cardGap: 16,
} as const;

export const radius = {
  card: 12,
  cardImage: 8,
  input: 8,
  button: 4,
  tag: 16,
  bottomSheetTop: 20,
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
