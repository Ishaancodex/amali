/**
 * Amenity status tag (PRD §8.5 status model table). Colour is never the
 * only signal — pairs a tag variant with a short label.
 */
import { Tag, type TagVariant } from '@/ui/Tag';
import type { AmenityStatus } from '@/types/amenity';

const STATUS_VARIANT: Record<AmenityStatus, TagVariant> = {
  open: 'success',
  limited: 'warning',
  closed: 'brand',
  maintenance: 'maintenance',
  emergency: 'danger',
};

const STATUS_LABEL: Record<AmenityStatus, string> = {
  open: 'Open',
  limited: 'Limited',
  closed: 'Closed',
  maintenance: 'Under maintenance',
  emergency: 'Emergency closure',
};

export function AmenityStatusTag({ status }: { status: AmenityStatus }) {
  return <Tag variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Tag>;
}
