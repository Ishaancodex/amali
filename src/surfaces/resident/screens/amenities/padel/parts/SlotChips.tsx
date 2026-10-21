'use client';

/**
 * The padel slot grid's chip (PRD M11): a slot that another device books
 * while you're looking flashes the brand tint once and then settles to the
 * booked style — the layout never moves under your finger. Selection fills
 * like every `FillChip` (M7).
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { dur, ease } from '@/design/motion';
import { FillChip } from '@/ui/FillChip';

export { FillChip };

/** Flashes once when `bookable` turns false without this device choosing it. */
export function SlotChip({
  bookable,
  selected,
  onClick,
  children,
}: {
  bookable: boolean;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const was = useRef(bookable);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (was.current && !bookable && !selected) setFlash((n) => n + 1);
    was.current = bookable;
  }, [bookable, selected]);

  return (
    <FillChip
      selected={selected}
      disabled={!bookable}
      onClick={onClick}
      className="text-body-3 py-2 tabular-nums"
    >
      {flash > 0 && (
        <motion.span
          key={flash}
          aria-hidden
          className="bg-brand-tint absolute -inset-px"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: dur.slower, ease: ease.standard }}
        />
      )}
      <span className="relative">{children}</span>
    </FillChip>
  );
}
