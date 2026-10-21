'use client';

/**
 * The programme's series: rule in words, venue and effect — and what needs
 * attention: classes a season's hours now exclude (with the suggested
 * time, PRD §8.6) and public holidays on class days, each with Skip / Keep.
 */
import { useMemo } from 'react';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { describeRule } from '@/domain/programme/recurrence';
import { programmeConflicts } from '@/store/selectors/programme';
import { fmtDate, fmtTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../../useConsoleActor';

const EFFECT = {
  limited: 'Limits the amenity',
  blackout: 'Blocks the court',
  event: 'Bookable class',
};
const VENUE: Record<string, string> = {
  pool: 'Pool',
  padel: 'Padel court',
  music: 'Music Room',
  screening: 'Screening Room',
};

export function SeriesList({ slot }: { slot: DeviceSlotId }) {
  const { push } = useNav(slot);
  const programme = useStore((s) => s.programme);
  const blackouts = useStore((s) => s.blackouts);
  const bookings = useStore((s) => s.bookings);
  const showtimes = useStore((s) => s.showtimes);
  const exceptions = useStore((s) => s.exceptions);
  const hours = useStore((s) => s.hours);
  // The live clock ticks every frame; conflicts only need re-checking when the minute changes.
  const nowMinute = useStore((s) => s.demo.clock.now.slice(0, 16));
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const { actor, assignedAmenities } = useConsoleActor(slot);
  const rows = useMemo(() => {
    const state = useStore.getState();
    const now = `${nowMinute}:00.000Z`;
    return Object.values(programme)
      .filter((p) => p.state === 'active')
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((p) => ({ p, c: programmeConflicts(state, p, now) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the records below are what conflicts read
  }, [programme, blackouts, bookings, showtimes, exceptions, hours, nowMinute]);

  function decide(programmeId: string, date: string, decision: 'skip' | 'keep') {
    if (!actor) return;
    const result = dispatch('programme.decideHoliday', { programmeId, date, decision }, actor, {
      assignedAmenities,
    });
    pushToast(
      slot,
      result.ok
        ? decision === 'skip'
          ? 'Class skipped that day.'
          : 'Class kept.'
        : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label-1 text-text-title">Series</h2>
      {rows.map(({ p, c }) => {
        const pendingHolidays = c.holidays.filter((h) => !h.decision);
        return (
          <Card key={p.id} className="flex flex-col gap-2">
            <button
              type="button"
              className="text-start"
              onClick={() => push('programme-edit', { id: p.id })}
            >
              <p className="text-label-2 text-text-title">{p.title}</p>
              <p className="text-body-3 text-text-muted">
                {describeRule(p.rrule, p.dtstart)} · {fmtTime(p.dtstart)} · {p.durationMins} min
              </p>
              <p className="text-body-3 text-text-muted">
                {VENUE[p.amenity] ?? p.amenity} · {EFFECT[p.effect]}
                {p.note ? ` · ${p.note}` : ''}
              </p>
            </button>
            {c.hours.length > 0 && (
              <div className="bg-warning/10 rounded-card flex flex-col gap-1 p-2">
                <Tag variant="warning">
                  {c.hours.length} {c.hours.length === 1 ? 'class falls' : 'classes fall'} outside
                  opening hours
                </Tag>
                <p className="text-body-3 text-text-body">
                  From {fmtDate(c.hours[0]!.occurrence.start)} the pool opens {c.hours[0]!.open}
                  {c.hours[0]!.suggestedStart
                    ? ` — move the class to ${fmtTime(c.hours[0]!.suggestedStart)}?`
                    : '.'}
                </p>
              </div>
            )}
            {pendingHolidays.slice(0, 3).map((h) => (
              <div key={h.date} className="flex items-center justify-between gap-2">
                <span className="text-body-3 text-text-body">
                  {fmtDate(h.occurrence.start)} · {h.name}
                </span>
                <div className="flex gap-1">
                  <Button variant="secondary" onClick={() => decide(p.id, h.date, 'skip')}>
                    Skip
                  </Button>
                  <Button variant="tertiary" onClick={() => decide(p.id, h.date, 'keep')}>
                    Keep
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        );
      })}
    </section>
  );
}
