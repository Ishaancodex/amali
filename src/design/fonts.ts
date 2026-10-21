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
import { Poppins, Barlow, Alex_Brush, IBM_Plex_Sans_Arabic } from 'next/font/google';

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

export const fontVariables = [
  poppins.variable,
  barlow.variable,
  alexBrush.variable,
  ibmPlexSansArabic.variable,
].join(' ');
