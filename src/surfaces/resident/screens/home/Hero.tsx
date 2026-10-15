'use client';

/**
 * Home hero (PRD §9.1): a 320px full-bleed render, "Amali ▾" community
 * switcher, a glass icon button, the SOS pill. Greeting overlays the
 * bottom in the brand's script accent (PRD §6's real Amali render,
 * `public/brand/hero.jpg`, sourced from the brand guidelines' 3D render
 * guide — `.hero-gradient-fallback` in globals.css only shows if it fails
 * to load).
 */
import { useState } from 'react';
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
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`relative h-80 w-full overflow-hidden ${imageFailed ? 'hero-gradient-fallback' : ''}`}
    >
      {!imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="relative flex items-center justify-between p-4">
        <button type="button" className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/amali-logo-white.svg" alt="Amali" className="h-5 w-auto" />
          <ChevronDown className="text-on-brand h-4 w-4" strokeWidth={1.5} />
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
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pt-14 pb-5">
        <p className="text-script-accent font-script text-on-brand">
          {greetingFor(now)}, {name}
        </p>
      </div>
    </div>
  );
}
