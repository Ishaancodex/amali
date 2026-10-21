'use client';

/** A content photo that never leaves a hole: if it fails to load, a flat Ember tile with an icon stands in. */
import { useState } from 'react';
import { PhotoFallback } from './PhotoFallback';
import type { LucideIcon } from './icons';
import { CalendarDays } from './icons';

export function Photo({
  src,
  className = '',
  icon = CalendarDays,
}: {
  src: string;
  className?: string;
  icon?: LucideIcon;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className={`${className} overflow-hidden`}>
        <PhotoFallback icon={icon} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
