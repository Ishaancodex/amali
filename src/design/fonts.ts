/**
 * Self-hosted fonts via `next/font/google` (TRD §2.3). PP Neue Montreal is a
 * commercial font with no files provided yet, so `tag` text style falls back
 * to Inter Tight with the same tracking (PRD §5.5).
 */
import { Manrope, Jost, IBM_Plex_Sans_Arabic, Inter_Tight } from 'next/font/google';

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jost',
  display: 'swap',
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

/** Fallback for PP Neue Montreal Book until licensed files are supplied. */
export const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-pp-neue-fallback',
  display: 'swap',
});

export const fontVariables = [
  manrope.variable,
  jost.variable,
  ibmPlexSansArabic.variable,
  interTight.variable,
].join(' ');
