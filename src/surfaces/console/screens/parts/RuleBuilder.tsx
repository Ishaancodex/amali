'use client';

/**
 * The RRULE builder (PRD §8.6): daily / weekly on days / monthly by date
 * or by weekday, every N, ending never (bounded by the 12-month horizon),
 * on a date, or after a count.
 */
import { Stepper } from '@/ui/Stepper';
import { Input } from '@/ui/Input';
import { cn } from '@/lib/cn';
import type { Freq, RuleSpec } from '@/domain/programme/recurrence';
import { useFmt, useT } from '@/i18n/hooks';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'rounded-tag text-label-3 px-3 py-1.5',
        active ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
      )}
    >
      {children}
    </button>
  );
}

export type EndMode = 'never' | 'until' | 'count';

export function RuleBuilder({
  spec,
  onChange,
  endMode,
  onEndMode,
}: {
  spec: RuleSpec;
  onChange: (spec: RuleSpec) => void;
  endMode: EndMode;
  onEndMode: (mode: EndMode) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const toggleDay = (d: number) =>
    onChange({
      ...spec,
      byWeekday: spec.byWeekday.includes(d)
        ? spec.byWeekday.filter((x) => x !== d)
        : [...spec.byWeekday, d],
    });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label-1 text-text-title">{t('console.rule.repeats')}</h2>
      <div className="flex flex-wrap gap-2">
        {(['daily', 'weekly', 'monthly'] as Freq[]).map((f) => (
          <Chip key={f} active={spec.freq === f} onClick={() => onChange({ ...spec, freq: f })}>
            {t(`console.rule.freq.${f}`)}
          </Chip>
        ))}
      </div>
      <Stepper
        label={t(`console.rule.every.${spec.freq}`)}
        value={spec.interval}
        min={1}
        max={12}
        onChange={(interval) => onChange({ ...spec, interval })}
      />
      {spec.freq === 'weekly' && (
        <div className="flex gap-1.5">
          {DAYS.map((d) => (
            <Chip
              key={d}
              label={fmt.weekday(d)}
              active={spec.byWeekday.includes(d)}
              onClick={() => toggleDay(d)}
            >
              {fmt.weekday(d, 'EEEEE')}
            </Chip>
          ))}
        </div>
      )}
      {spec.freq === 'monthly' && (
        <div className="flex gap-2">
          <Chip
            active={spec.monthlyMode === 'date'}
            onClick={() => onChange({ ...spec, monthlyMode: 'date' })}
          >
            {t('console.rule.sameDate')}
          </Chip>
          <Chip
            active={spec.monthlyMode === 'weekday'}
            onClick={() => onChange({ ...spec, monthlyMode: 'weekday' })}
          >
            {t('console.rule.sameWeekday')}
          </Chip>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Chip active={endMode === 'never'} onClick={() => onEndMode('never')}>
          {t('console.rule.noEnd')}
        </Chip>
        <Chip active={endMode === 'until'} onClick={() => onEndMode('until')}>
          {t('console.rule.until')}
        </Chip>
        <Chip active={endMode === 'count'} onClick={() => onEndMode('count')}>
          {t('console.rule.count')}
        </Chip>
      </div>
      {endMode === 'until' && (
        <Input
          label={t('console.rule.lastDate')}
          type="date"
          value={spec.untilDate ?? ''}
          onChange={(e) => onChange({ ...spec, untilDate: e.target.value || undefined })}
        />
      )}
      {endMode === 'count' && (
        <Stepper
          label={t('console.rule.occurrences')}
          value={spec.count ?? 10}
          min={1}
          max={200}
          onChange={(count) => onChange({ ...spec, count })}
        />
      )}
    </section>
  );
}
