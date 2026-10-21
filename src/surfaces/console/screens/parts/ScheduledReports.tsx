'use client';

/**
 * Scheduled reports (PRD §8.10: "Reports can be saved as a schedule (e.g.
 * every Monday at 08:00 by email). The email is simulated, so it appears
 * in a 'Scheduled' list.")
 */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { CalendarClock } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { reportScope } from '@/store/selectors/report';
import { cn } from '@/lib/cn';
import type { DeviceSlotId } from '@/types/demo';
import type { ReportSchedule } from '@/types/report';
import { useConsoleActor } from '../../useConsoleActor';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function ScheduledReports({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { actor, consoleRole, assignedAmenities } = useConsoleActor(slot);
  const schedules = useStore((s) => s.reportSchedules);
  const staff = useStore((s) => (actor ? s.staff[actor.id] : undefined));
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => t('console.schedule.defaultName'));
  const [weekday, setWeekday] = useState<ReportSchedule['weekday']>(1);
  const [time, setTime] = useState('08:00');
  const [email, setEmail] = useState(`${(staff?.name ?? 'manager').toLowerCase()}@amali.example`);

  if (!actor || !consoleRole) return null;
  const list = Object.values(schedules).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  function save() {
    const result = dispatch(
      'report.schedule',
      {
        name,
        windowDays: 7,
        amenities: reportScope(consoleRole!, assignedAmenities).amenities,
        weekday,
        time,
        email,
      },
      actor!,
      { assignedAmenities },
    );
    pushToast(
      slot,
      result.ok
        ? t('console.schedule.saved', { day: fmt.weekday(weekday), time })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
    if (result.ok) setOpen(false);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-label-1 text-text-title flex items-center gap-2">
          <CalendarClock className="h-4 w-4" strokeWidth={1.5} />
          {t('console.schedule.title')}
        </h2>
        {!open && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t('console.schedule.saveAs')}
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          <Input
            label={t('console.schedule.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={weekday === d}
                onClick={() => setWeekday(d)}
                className={cn(
                  'rounded-tag text-label-3 px-2.5 py-1',
                  weekday === d ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {fmt.weekday(d, 'EEE')}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Input
              label={t('padel.time')}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <Input
              label={t('console.schedule.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="tertiary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save}>{t('console.schedule.save')}</Button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-body-3 text-text-muted">{t('console.schedule.none')}</p>
      ) : (
        list.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <span className="text-body-2 text-text-body">
              {t('console.schedule.row', {
                name: s.name,
                day: fmt.weekday(s.weekday),
                time: s.time,
              })}{' '}
              → <bdi>{s.email}</bdi> {t('console.schedule.simulated')}
            </span>
            <Button
              variant="tertiary"
              onClick={() =>
                dispatch('report.unschedule', { scheduleId: s.id }, actor, { assignedAmenities })
              }
            >
              {t('console.schedule.remove')}
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}
