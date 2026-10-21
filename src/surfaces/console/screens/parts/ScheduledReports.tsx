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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduledReports({ slot }: { slot: DeviceSlotId }) {
  const { actor, consoleRole, assignedAmenities } = useConsoleActor(slot);
  const schedules = useStore((s) => s.reportSchedules);
  const staff = useStore((s) => (actor ? s.staff[actor.id] : undefined));
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Weekly amenities report');
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
      result.ok ? `Scheduled — every ${DAYS[weekday]} at ${time}.` : result.error.message,
      result.ok ? 'success' : 'error',
    );
    if (result.ok) setOpen(false);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-label-1 text-text-title flex items-center gap-2">
          <CalendarClock className="h-4 w-4" strokeWidth={1.5} />
          Scheduled
        </h2>
        {!open && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Save as schedule
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setWeekday(i as ReportSchedule['weekday'])}
                className={cn(
                  'rounded-tag text-label-3 px-2.5 py-1',
                  weekday === i ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Input
              label="Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="tertiary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save schedule</Button>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-body-3 text-text-muted">No scheduled reports.</p>
      ) : (
        list.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <span className="text-body-2 text-text-body">
              {s.name} · every {DAYS[s.weekday]} at {s.time} → {s.email} (simulated)
            </span>
            <Button
              variant="tertiary"
              onClick={() =>
                dispatch('report.unschedule', { scheduleId: s.id }, actor, { assignedAmenities })
              }
            >
              Remove
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}
