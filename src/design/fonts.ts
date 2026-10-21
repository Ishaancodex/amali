/**
 * Self-hosted fonts via `next/font/google` (TRD §2.3), chosen to match
 * `documents/Amali Properties_Brand Guidelines.pdf`: Poppins stands in for
 * the brand's primary typeface (Aviano Sans — commercial, no license
 * supplied) since it shares the same five-weight range (Thin/Light/
 * Regular/Bold/Black ≈ 300/400/500/700/900) and the same geometric,
 * rounded-terminal character. Barlow stands in for the secondary typeface
 * (DIN 2014 — also commercial) for the same reason designers commonly pair
 * it with DIN: a low-contrast, slightly condensed industrial grotesque.
 * Alex Brush stands in for the brand's script accent ("Romantically") for
 * the one decorative, non-functional moment that calls for it (the Home
 * hero greeting) — never for dense or functional UI text.
 */
import {
  Poppins,
  Barlow,
  Alex_Brush,
  IBM_Plex_Sans_Arabic,
  Instrument_Serif,
  Julius_Sans_One,
  Amiri,
} from 'next/font/google';

export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

export const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-barlow',
  display: 'swap',
});

export const alexBrush = Alex_Brush({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-script-accent',
  display: 'swap',
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
  // Only the Arabic subset is loaded, and it goes first in the Arabic stack (globals.css): with no
  // metric fallback of its own, Latin characters fall through to Poppins rather than to Arial.
  adjustFontFallback: false,
});

/**
 * Resident header type (competitor-reference-review.md): Instrument Serif italic for titles
 * and big numerals, Julius Sans One for tracked caps eyebrows. Both are OFL; neither is in
 * the brand book (Aviano Sans / DIN 2014), so this is a stakeholder-approved addition.
 * Amiri is the Arabic counterpart of the serif role (Arabic has no italic).
 */
export const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const juliusSansOne = Julius_Sans_One({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-julius-sans',
  display: 'swap',
});

export const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400'],
  variable: '--font-amiri',
  display: 'swap',
  adjustFontFallback: false,
});

export const fontVariables = [
  poppins.variable,
  barlow.variable,
  alexBrush.variable,
  ibmPlexSansArabic.variable,
  instrumentSerif.variable,
  juliusSansOne.variable,
  amiri.variable,
].join(' ');
