'use client';

/**
 * Create or edit a programme series (PRD §8.6): name, venue (which sets
 * the effect — the pool runs Limited, the padel court blacks out, a room
 * books like an event), first date and time, duration, the RRULE builder,
 * and a live preview of occurrences and conflicts. Editing an existing
 * series here changes all of it; single occurrences are edited from the
 * calendar.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Stepper } from '@/ui/Stepper';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { addDaysIso, dubaiDateKey, dubaiDateTimeToIso, fmtTime } from '@/lib/time';
import { useAmenityLabel, useErrorText, useT } from '@/i18n/hooks';
import { cn } from '@/lib/cn';
import { buildRule, describeRule, parseRule, type RuleSpec } from '@/domain/programme/recurrence';
import { blockingConflicts } from '@/domain/programme/conflicts';
import { programmeConflicts, upcomingOccurrences } from '@/store/selectors/programme';
import type { AmenityKey } from '@/types/amenity';
import type { BlackoutHandling } from '@/types/amenity';
import type { ProgrammeEffect } from '@/types/programme';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';
import { RuleBuilder, type EndMode } from './parts/RuleBuilder';
import { ProgrammePreview } from './parts/ProgrammePreview';

const VENUES: { key: AmenityKey; effect: ProgrammeEffect }[] = [
  { key: 'pool', effect: 'limited' },
  { key: 'padel', effect: 'blackout' },
  { key: 'music', effect: 'event' },
  { key: 'screening', effect: 'event' },
];
const DURATION_STEP = 15;

export function SeriesEditorScreen({
  slot,
  programmeId,
}: {
  slot: DeviceSlotId;
  programmeId?: string;
}) {
  const t = useT();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const { pop } = useNav(slot);
  const existing = useStore((s) => (programmeId ? s.programme[programmeId] : undefined));
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amenity, setAmenity] = useState<AmenityKey>(existing?.amenity ?? 'pool');
  const [note, setNote] = useState(existing?.note ?? '');
  const [capacity, setCapacity] = useState(existing?.capacity ?? 8);
  const [date, setDate] = useState(dubaiDateKey(existing?.dtstart ?? addDaysIso(now, 1)));
  const [time, setTime] = useState(existing ? fmtTime(existing.dtstart) : '10:00');
  const [duration, setDuration] = useState(existing?.durationMins ?? 60);
  const [spec, setSpec] = useState<RuleSpec>(
    existing
      ? parseRule(existing.rrule)
      : { freq: 'weekly', interval: 1, byWeekday: [], monthlyMode: 'date' },
  );
  const [endMode, setEndMode] = useState<EndMode>(
    spec.count ? 'count' : spec.untilDate ? 'until' : 'never',
  );
  const [handling, setHandling] = useState<BlackoutHandling>('cancel_priority_rebook');
  const [skip, setSkip] = useState(false);

  const effect = VENUES.find((v) => v.key === amenity)!.effect;
  const dtstart = dubaiDateTimeToIso(date, time);
  const ruleSpec: RuleSpec = {
    ...spec,
    count: endMode === 'count' ? (spec.count ?? 10) : undefined,
    untilDate: endMode === 'until' ? spec.untilDate : undefined,
  };
  const rrule = buildRule(ruleSpec, dtstart);
  const candidate = {
    id: existing?.id ?? 'draft',
    title: title || t('console.programme.newSeries'),
    amenity,
    effect,
    rrule,
    dtstart,
    durationMins: duration,
    exdates: existing?.exdates ?? [],
    overrides: {},
    holidayDecisions: existing?.holidayDecisions ?? {},
  };
  const occurrences = upcomingOccurrences(candidate, now);
  const conflicts = programmeConflicts(useStore.getState(), candidate, now);
  const blocked = blockingConflicts(conflicts) > 0 && !skip;

  function save() {
    if (!actor) return;
    const opts = {
      handling: conflicts.bookings.affectedBookings.length ? handling : undefined,
      skipConflicts: skip,
    };
    const result = existing
      ? dispatch(
          'programme.edit',
          {
            programmeId: existing.id,
            originalStart: occurrences[0]?.originalStart ?? existing.dtstart,
            scope: 'all',
            change: { title, note, durationMins: duration, startTime: time, rrule },
            ...opts,
          },
          actor,
          { assignedAmenities },
        )
      : dispatch(
          'programme.create',
          {
            title,
            amenity,
            effect,
            note,
            rrule,
            dtstart,
            durationMins: duration,
            capacity: effect === 'event' ? capacity : undefined,
            ...opts,
          },
          actor,
          { assignedAmenities },
        );
    if (!result.ok) {
      pushToast(slot, errorText(result.error), 'error');
      return;
    }
    pushToast(
      slot,
      t('console.seriesEditor.saved', { title, count: result.value.occurrences }),
      'success',
    );
    pop();
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={
          existing
            ? t('console.seriesEditor.edit', { title: existing.title })
            : t('console.programme.newSeries')
        }
        onBack={pop}
      />
      <div className="flex min-h-0 flex-1 gap-6 overflow-y-auto px-6 pb-6">
        <section className="flex max-w-md flex-1 flex-col gap-4 [&>*]:shrink-0">
          <Input
            label={t('console.schedule.name')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('console.seriesEditor.nameHint')}
          />
          <div className="flex flex-wrap gap-2">
            {VENUES.map((v) => (
              <button
                key={v.key}
                type="button"
                disabled={!!existing}
                onClick={() => setAmenity(v.key)}
                className={cn(
                  'rounded-tag text-label-3 px-3 py-1.5 disabled:opacity-50',
                  amenity === v.key ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {amenityLabel(v.key, 'short')}
              </button>
            ))}
          </div>
          <p className="text-body-3 text-text-muted">
            {t(`console.seriesEditor.effectNote.${effect}`)}
          </p>
          {effect === 'limited' && (
            <Input
              label={t('console.seriesEditor.shownAs')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('console.seriesEditor.shownAsHint')}
            />
          )}
          {effect === 'event' && (
            <Stepper
              label={t('console.seriesEditor.spaces')}
              value={capacity}
              min={1}
              max={40}
              onChange={setCapacity}
            />
          )}
          <div className="flex gap-3">
            <Input
              label={t('console.seriesEditor.firstDate')}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label={t('console.seriesEditor.start')}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <Stepper
            label={t('console.seriesEditor.duration', { minutes: duration })}
            value={duration / DURATION_STEP}
            min={1}
            max={16}
            onChange={(n) => setDuration(n * DURATION_STEP)}
          />
          <RuleBuilder spec={spec} onChange={setSpec} endMode={endMode} onEndMode={setEndMode} />
        </section>
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <ProgrammePreview
            description={describeRule(rrule, dtstart)}
            occurrences={occurrences}
            conflicts={conflicts}
            handling={handling}
            onHandling={setHandling}
            skip={skip}
            onSkip={setSkip}
          />
          <Button
            fullWidth
            disabled={!title.trim() || occurrences.length === 0 || blocked}
            onClick={save}
          >
            {existing ? t('console.seriesEditor.saveAll') : t('console.seriesEditor.create')}
          </Button>
        </section>
      </div>
    </div>
  );
}
