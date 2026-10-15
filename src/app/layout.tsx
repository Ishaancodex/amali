import type { Metadata } from 'next';
import { fontVariables } from '@/design/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amali Residences — Amenities Operations',
  description: 'Amali Residences amenities operations prototype (demo).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      {/* No `font-sans` class here — see the `body { font-family }` rule in
          globals.css for why the brand's primary typeface is set directly. */}
      <body className={`${fontVariables} antialiased`}>{children}</body>
    </html>
  );
}
