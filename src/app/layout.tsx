import type { Metadata } from 'next';
import { fontVariables } from '@/design/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amali Residences — Amenities Operations',
  description: 'Amali Residences amenities operations prototype (demo).',
  icons: { icon: '/brand/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* The resident home's hero render is the first big paint (LCP) — fetch it with the HTML. */}
        <link rel="preload" as="image" href="/brand/hero.jpg" fetchPriority="high" />
      </head>
      {/* No `font-sans` class here — see the `body { font-family }` rule in
          globals.css for why the brand's primary typeface is set directly. */}
      <body className={`${fontVariables} antialiased`}>{children}</body>
    </html>
  );
}
