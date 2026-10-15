'use client';

/**
 * Home hero (PRD §9.1): a 320px full-bleed render, "AMALI ▾" community
 * switcher, a glass icon button, the SOS pill. Greeting overlays the
 * bottom. No real Amali render has been supplied (PRD §18.7) — see
 * `.hero-gradient-fallback` in globals.css for the stand-in.
 */
import { ChevronDown } from '@/ui/icons';
import { IconButton } from '@/ui/IconButton';
import { Bell } from '@/ui/icons';

function greetingFor(now: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai',
    }).format(new Date(now)),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Hero({ name, now, onSos }: { name: string; now: string; onSos: () => void }) {
  return (
    <div className="hero-gradient-fallback relative h-80 w-full overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <button type="button" className="text-label-1 text-on-brand flex items-center gap-1">
          AMALI
          <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2">
          <IconButton icon={Bell} label="Notifications" variant="glass" />
          <button
            type="button"
            onClick={onSos}
            className="sos-gradient rounded-tag text-button text-on-brand shadow-card-hover px-4 py-1.5"
          >
            SOS
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pt-10 pb-5">
        <p className="text-display text-on-brand">
          {greetingFor(now)}, {name}
        </p>
      </div>
    </div>
  );
}
