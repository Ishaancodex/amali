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
import { toDubai } from '@/lib/time';
import { useT } from '@/i18n/hooks';

function greetingKey(now: string) {
  const hour = toDubai(now).getHours();
  if (hour < 12) return 'resident.home.greeting.morning' as const;
  if (hour < 17) return 'resident.home.greeting.afternoon' as const;
  return 'resident.home.greeting.evening' as const;
}

export function Hero({ name, now, onSos }: { name: string; now: string; onSos: () => void }) {
  const t = useT();
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
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="relative flex items-center justify-between p-4">
        <button type="button" className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/amali-logo-white.svg"
            alt={t('resident.home.brand')}
            className="h-5 w-auto"
          />
          <ChevronDown className="text-on-brand h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2">
          <IconButton icon={Bell} label={t('resident.home.notifications')} variant="glass" />
          <button
            type="button"
            onClick={onSos}
            className="sos-gradient rounded-tag text-button text-on-brand shadow-card-hover px-4 py-1.5"
          >
            {t('resident.home.sos')}
          </button>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pt-14 pb-5">
        <p className="text-script-accent font-script text-on-brand">
          {t(greetingKey(now), { name })}
        </p>
      </div>
    </div>
  );
}
