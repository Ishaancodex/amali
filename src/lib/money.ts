/**
 * Money helpers. Stored as integer fils (AED × 100) so arithmetic never hits
 * floating-point errors (TRD §5, CLAUDE.md).
 */

export function aedToFils(aed: number): number {
  return Math.round(aed * 100);
}

export function filsToAed(fils: number): number {
  return fils / 100;
}

const aedFormatterEn = new Intl.NumberFormat('en-AE', {
  style: 'currency',
  currency: 'AED',
  currencyDisplay: 'code',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const aedFormatterAr = new Intl.NumberFormat('ar-AE', {
  style: 'currency',
  currency: 'AED',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "AED 1,250" (en) or "1,250 د.إ" (ar) — PRD §14. */
export function fmtAed(fils: number, locale: 'en' | 'ar' = 'en'): string {
  const amount = filsToAed(fils);
  return locale === 'ar' ? aedFormatterAr.format(amount) : aedFormatterEn.format(amount);
}

export function sumFils(amounts: number[]): number {
  return amounts.reduce((total, n) => total + n, 0);
}
