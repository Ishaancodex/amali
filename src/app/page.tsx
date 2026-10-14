import Link from 'next/link';

/**
 * Placeholder root route. The real demo shell (role pill, device frames,
 * notes panel — PRD §4) lands in Phase P1. For now this just confirms the
 * app boots and links to the token preview.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-title-l font-medium text-text-title">Amali Residences</h1>
      <p className="max-w-md text-body-2 text-text-muted">
        Amenities operations prototype — foundations are in place. The presentation shell (role
        switcher, device frames, scenarios) is built in Phase P1.
      </p>
      <Link
        href="/tokens"
        className="rounded-button bg-brand px-6 py-3 text-button text-on-brand transition-transform active:scale-[0.97]"
      >
        View design tokens
      </Link>
    </main>
  );
}
