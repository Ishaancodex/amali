'use client';

/**
 * The composer's audience builder (PRD §8.7): tower / cluster / floor-range
 * chips combined by union, and the live preview count.
 */
import { useT } from '@/i18n/hooks';
import type { AudienceClause } from '@/types/comms';

export type AudienceChip = 'all' | 'east' | 'west' | 'north' | 'south' | 'floors';
const CHIPS: AudienceChip[] = ['all', 'east', 'west', 'north', 'south', 'floors'];

export interface FloorRange {
  tower: 'east' | 'west';
  from: number;
  to: number;
}

export function clausesFor(chips: Set<AudienceChip>, floors: FloorRange): AudienceClause[] {
  const out: AudienceClause[] = [];
  if (chips.has('all')) out.push({ kind: 'all' });
  if (chips.has('east')) out.push({ kind: 'tower', tower: 'east' });
  if (chips.has('west')) out.push({ kind: 'tower', tower: 'west' });
  if (chips.has('north')) out.push({ kind: 'cluster', cluster: 'north' });
  if (chips.has('south')) out.push({ kind: 'cluster', cluster: 'south' });
  if (chips.has('floors')) out.push({ kind: 'floors', ...floors });
  return out;
}

export function toggleChip(prev: Set<AudienceChip>, chip: AudienceChip): Set<AudienceChip> {
  if (chip === 'all') return new Set(['all']);
  const next = new Set(prev);
  next.delete('all');
  if (next.has(chip)) next.delete(chip);
  else next.add(chip);
  if (next.size === 0) next.add('all');
  return next;
}

const FIELD = 'rounded-input border-border-card bg-surface text-body-3 h-9 border px-2';

export function ComposerAudience({
  chips,
  onToggle,
  floors,
  onFloors,
  preview,
}: {
  chips: Set<AudienceChip>;
  onToggle: (chip: AudienceChip) => void;
  floors: FloorRange;
  onFloors: (floors: FloorRange) => void;
  preview: {
    residentCount: number;
    unitCount: number;
    appReachable: number;
    waReachable: number;
    unreachable: number;
  };
}) {
  const t = useT();
  return (
    <section>
      <h2 className="text-label-1 text-text-title mb-2">{t('console.composer.audience')}</h2>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            aria-pressed={chips.has(chip)}
            onClick={() => onToggle(chip)}
            className={`rounded-tag text-label-3 px-3 py-1.5 ${chips.has(chip) ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
          >
            {t(`console.composer.chip.${chip}`)}
          </button>
        ))}
      </div>
      {chips.has('floors') && (
        <div className="mt-2 flex items-center gap-2">
          <select
            aria-label={t('console.composer.tower')}
            value={floors.tower}
            onChange={(e) => onFloors({ ...floors, tower: e.target.value as 'east' | 'west' })}
            className={FIELD}
          >
            <option value="east">{t('console.tower.east')}</option>
            <option value="west">{t('console.tower.west')}</option>
          </select>
          <input
            type="number"
            aria-label={t('console.composer.floorFrom')}
            value={floors.from}
            onChange={(e) => onFloors({ ...floors, from: Number(e.target.value) })}
            className={`${FIELD} w-20`}
          />
          <span className="text-body-3 text-text-muted">{t('console.composer.to')}</span>
          <input
            type="number"
            aria-label={t('console.composer.floorTo')}
            value={floors.to}
            onChange={(e) => onFloors({ ...floors, to: Number(e.target.value) })}
            className={`${FIELD} w-20`}
          />
        </div>
      )}
      <p className="text-body-3 text-text-muted mt-2" aria-live="polite">
        {t('console.composer.preview', preview)}
      </p>
    </section>
  );
}
