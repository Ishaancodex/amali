/**
 * Amenity status tag (PRD §8.5 status model table). Colour is never the
 * only signal — pairs a tag variant with a short label.
 */
'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Tag, type TagVariant } from '@/ui/Tag';
import { dur, ease } from '@/design/motion';
import type { AmenityStatus } from '@/types/amenity';
import { useT } from '@/i18n/hooks';

const STATUS_VARIANT: Record<AmenityStatus, TagVariant> = {
  open: 'success',
  limited: 'warning',
  closed: 'brand',
  maintenance: 'maintenance',
  emergency: 'danger',
};

/** M15: on a change the old label slides up and out, the new one up and in. */
export function AmenityStatusTag({ status }: { status: AmenityStatus }) {
  const t = useT();
  return (
    <span className="inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: dur.base, ease: ease.standard }}
        >
          <Tag variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Tag>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
