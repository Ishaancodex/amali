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
      <body className={`${fontVariables} font-sans antialiased`}>{children}</body>
    </html>
  );
}
