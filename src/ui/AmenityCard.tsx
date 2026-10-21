'use client';

/**
 * Amenity card (PRD §5.7): 132px image, title, hours line, price line, and
 * a secondary "Book" button overlapping the bottom-right of the image.
 * Falls back to the Amali gradient + line icon if the image 404s
 * (PRD §5.8). The card and Book button are sibling buttons (not nested —
 * HTML forbids a <button> inside a <button>), both absolutely positioned
 * within a shared container so Book still visually overlaps the image.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { dur, ease } from '@/design/motion';
import type { LucideIcon } from './icons';
import { AmenityStatusTag } from '@/features/status/AmenityStatusTag';
import type { AmenityStatus } from '@/types/amenity';
import { useT } from '@/i18n/hooks';

const IMAGE_HEIGHT_PX = 132;
const DIMMED: AmenityStatus[] = ['closed', 'maintenance', 'emergency'];

export function AmenityCard({
  image,
  icon: Icon,
  title,
  hoursLine,
  priceLine,
  status,
  bookable,
  onOpen,
  onBook,
}: {
  image: string;
  icon: LucideIcon;
  title: string;
  hoursLine: string;
  priceLine?: string;
  status: AmenityStatus;
  bookable: boolean;
  onOpen: () => void;
  onBook?: () => void;
}) {
  const t = useT();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="rounded-card border-border-card bg-surface relative w-full overflow-hidden border-[0.5px]">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col text-start transition-transform active:scale-[0.98]"
      >
        <div className="relative w-full" style={{ height: IMAGE_HEIGHT_PX }}>
          {imageFailed ? (
            <div className="from-brand-tint to-gradient-placeholder-end flex h-full w-full items-center justify-center bg-gradient-to-br">
              <Icon className="text-brand h-9 w-9" strokeWidth={1.5} />
            </div>
          ) : (
            // M15: closed or under maintenance, the photo desaturates to 60%.
            <motion.img
              src={image}
              alt=""
              className="h-full w-full object-cover"
              initial={false}
              animate={{ filter: `saturate(${DIMMED.includes(status) ? 0.6 : 1})` }}
              transition={{ duration: dur.slower, ease: ease.standard }}
              onError={() => setImageFailed(true)}
            />
          )}
          <div className="absolute end-2 top-2">
            <AmenityStatusTag status={status} />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-3 pt-4 pb-3">
          <span className="text-label-1 text-text-title">{title}</span>
          <span className="text-body-3 text-text-muted">{hoursLine}</span>
          {priceLine && <span className="text-body-3 text-text-muted">{priceLine}</span>}
        </div>
      </button>

      {bookable && onBook && (
        <button
          type="button"
          onClick={onBook}
          className="rounded-button bg-brand-tint text-button text-brand shadow-card-hover absolute end-3 px-4 py-2"
          style={{ top: IMAGE_HEIGHT_PX - 14 }}
        >
          {t('ui.book')}
        </button>
      )}
    </div>
  );
}
