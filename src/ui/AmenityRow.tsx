'use client';

/**
 * Amenity list row: a photo thumbnail that morphs into the detail hero (shared `layoutId`), the
 * name, a status dot and the hours. The Book pill is a sibling of the row button (a <button> can't
 * hold a <button>) laid over its trailing edge. Without a photo the thumbnail is an art tile.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from './icons';
import { PhotoFallback } from './PhotoFallback';
import type { LucideIcon } from './icons';
import { AmenityStatusTag } from '@/features/status/AmenityStatusTag';
import { dur, ease } from '@/design/motion';
import type { AmenityStatus } from '@/types/amenity';
import { useT } from '@/i18n/hooks';

const DIMMED: AmenityStatus[] = ['closed', 'maintenance', 'emergency'];

export function AmenityRow({
  icon,
  layoutId,
  image,
  title,
  hoursLine,
  priceLine,
  status,
  onOpen,
  onBook,
}: {
  icon: LucideIcon;
  layoutId: string;
  image: string;
  title: string;
  hoursLine: string;
  priceLine?: string;
  status: AmenityStatus;
  onOpen: () => void;
  onBook?: () => void;
}) {
  const t = useT();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="border-border-card relative border-b-[0.5px] last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 py-3 text-start transition-transform active:scale-[0.99]"
      >
        {imageFailed ? (
          <div className="rounded-card-image h-24 w-[5.5rem] shrink-0 overflow-hidden">
            <PhotoFallback icon={icon} />
          </div>
        ) : (
          <motion.img
            layoutId={layoutId}
            src={image}
            alt=""
            className="rounded-card-image h-24 w-[5.5rem] shrink-0 object-cover"
            // M15: closed or under maintenance, the photo desaturates.
            animate={{ filter: `saturate(${DIMMED.includes(status) ? 0.6 : 1})` }}
            transition={{ duration: dur.slower, ease: ease.standard }}
            onError={() => setImageFailed(true)}
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="font-serif-display text-serif-section text-text-title">{title}</span>
          <AmenityStatusTag status={status} />
          <span className="text-body-3 text-text-muted">{hoursLine}</span>
          {priceLine && <span className="text-body-3 text-text-muted">{priceLine}</span>}
        </span>
        {!onBook && (
          <ChevronRight
            className="text-text-muted h-4 w-4 shrink-0 rtl:-scale-x-100"
            strokeWidth={1.5}
          />
        )}
      </button>
      {onBook && (
        <button
          type="button"
          onClick={onBook}
          className="bg-ember text-on-ember font-wide text-eyebrow absolute end-0 top-1/2 h-8 -translate-y-1/2 rounded-full px-4"
        >
          {t('ui.book')}
        </button>
      )}
    </div>
  );
}
