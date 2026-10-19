/**
 * The 6 daily operations checklist templates (PRD §8.5): Opening / Midday
 * / Closing × Pool / Gym. Deterministic, literal — no rng needed.
 */
import type { ChecklistTemplate } from '@/types/ops';

function items(labels: readonly string[]): ChecklistTemplate['items'] {
  return labels.map((label, i) => ({ id: `item-${i}`, label }));
}

const POOL_ITEMS = items([
  'Deck clear',
  'Safety equipment present',
  'Lifeguard on station',
  'Signage in place',
  'Showers working',
  'Towels stocked',
]);
const GYM_ITEMS = items(['Equipment wiped', 'AC check', 'Water dispenser stocked']);

export function buildChecklistTemplates(now: string): Record<string, ChecklistTemplate> {
  const defs: {
    amenity: ChecklistTemplate['amenity'];
    kind: ChecklistTemplate['kind'];
    dueTime: string;
    items: ChecklistTemplate['items'];
  }[] = [
    { amenity: 'pool', kind: 'opening', dueTime: '05:45', items: POOL_ITEMS },
    { amenity: 'pool', kind: 'midday', dueTime: '14:00', items: POOL_ITEMS },
    { amenity: 'pool', kind: 'closing', dueTime: '22:00', items: POOL_ITEMS },
    { amenity: 'gym', kind: 'opening', dueTime: '05:45', items: GYM_ITEMS },
    { amenity: 'gym', kind: 'midday', dueTime: '14:00', items: GYM_ITEMS },
    { amenity: 'gym', kind: 'closing', dueTime: '22:00', items: GYM_ITEMS },
  ];

  const out: Record<string, ChecklistTemplate> = {};
  for (const def of defs) {
    // Literal, deterministic — not `lib/ids.ts#id()` (random), so the same seed stays byte-identical.
    const templateId = `checklist_${def.amenity}_${def.kind}`;
    out[templateId] = { id: templateId, createdAt: now, updatedAt: now, ...def };
  }
  return out;
}
