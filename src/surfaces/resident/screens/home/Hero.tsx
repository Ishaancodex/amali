'use client';

/**
 * Home hero (PRD §9.1): the Amali render settling in (Ken Burns) under a flat veil, with the
 * "Amali ▾" switcher, a glass bell and the SOS pill. The greeting sits on a solid Ember block
 * below the photo, so text never lies on the image. If `public/brand/hero.jpg` fails to load the
 * band is simply flat Ember.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Bell } from '@/ui/icons';
import { IconButton } from '@/ui/IconButton';
import { Eyebrow } from '@/ui/Eyebrow';
import { kenBurns } from '@/design/motion';
import { toDubai } from '@/lib/time';
import { useT } from '@/i18n/hooks';

function greetingKey(now: string) {
  const hour = toDubai(now).getHours();
  if (hour < 12) return 'morning' as const;
  if (hour < 17) return 'afternoon' as const;
  return 'evening' as const;
}

export function Hero({
  name,
  unitId,
  now,
  onSos,
}: {
  name: string;
  unitId: string;
  now: string;
  onSos: () => void;
}) {
  const t = useT();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="bg-ember w-full">
      <div className="relative h-72 w-full overflow-hidden">
        {!imageFailed && (
          <motion.img
            src="/brand/hero.jpg"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
            variants={kenBurns}
            initial="initial"
            animate="animate"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="bg-ember-veil absolute inset-0" />
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
              className="bg-sos rounded-tag text-button text-on-brand shadow-card-hover px-4 py-1.5"
            >
              {t('resident.home.sos')}
            </button>
          </div>
        </div>
      </div>
      <div className="px-5 pt-4 pb-10">
        <Eyebrow className="text-on-ember-muted block">
          {t(`resident.home.greetingEyebrow.${greetingKey(now)}`)}
        </Eyebrow>
        <p className="text-script-accent font-script text-on-ember">{name}</p>
        <p className="text-body-3 text-on-ember-muted mt-1">
          {t('resident.home.unitLine', { unit: unitId })}
        </p>
      </div>
    </div>
  );
}
