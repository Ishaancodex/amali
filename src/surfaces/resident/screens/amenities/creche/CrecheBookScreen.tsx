'use client';

/**
 * Book the Kids' Club (PRD §8.3): pick the children (siblings book
 * together, each against their own band), a day in the 7-day window, and
 * the morning or afternoon session or an hourly drop-in block. A full band
 * offers the waitlist rather than refusing.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Stepper } from '@/ui/Stepper';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { BAND_LABEL, bandForChild } from '@/domain/creche/bands';
import { countActiveInWindow, staffOnBand } from '@/domain/creche/capacity';
import { crecheSessionId as sessionId } from '@/domain/creche/sessionIds';
import { addDaysIso, addHoursIso, dubaiDateKey, dubaiDateTimeToIso, fmtDate } from '@/lib/time';
import { cn } from '@/lib/cn';
import type { DeviceSlotId } from '@/types/demo';

type Kind = 'morning' | 'afternoon' | 'dropin';
const DROP_IN_STARTS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
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

export function CrecheBookScreen({ slot, childId }: { slot: DeviceSlotId; childId?: string }) {
  const { pop } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const rightsHolder = useStore((s) =>
    resident ? s.residents[s.units[resident.unitId]?.amenityRightsHolderId ?? ''] : undefined,
  );
  const childrenRecord = useStore((s) => s.children);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const bandAssignments = useStore((s) => s.bandAssignments);
  const shifts = useStore((s) => s.shifts);
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);

  const children = Object.values(childrenRecord).filter((c) => c.unitId === resident?.unitId);
  const [picked, setPicked] = useState<string[]>(
    childId ? [childId] : children.slice(0, 1).map((c) => c.id),
  );
  const days = Array.from({ length: rules.creche.bookingWindowDays + 1 }, (_, i) =>
    dubaiDateKey(addDaysIso(now, i)),
  );
  const [day, setDay] = useState(days[0]!);
  const [kind, setKind] = useState<Kind>('morning');
  const [dropStart, setDropStart] = useState('15:00');
  const [hours, setHours] = useState(rules.creche.sessions.dropIn.minHours);
  const [error, setError] = useState<string | undefined>();

  if (!resident) return null;

  const window =
    kind === 'dropin'
      ? {
          start: dubaiDateTimeToIso(day, dropStart),
          end: addHoursIso(dubaiDateTimeToIso(day, dropStart), hours),
        }
      : (crecheSessions[sessionId(day, kind)] ?? { start: '', end: '' });
  const tenant = rightsHolder?.type === 'tenant';

  function placesLeft(childDob: string) {
    const band = bandForChild(childDob, day, rules.creche.bands, rules.creche.minAcceptedAge);
    if (!band.ok || !window.start) return band.ok ? '' : band.message;
    const staff = staffOnBand(
      bandAssignments,
      Object.values(shifts),
      day,
      band.band,
      window.start,
      window.end,
    );
    const cap = staff.length * rules.creche.bands[band.band].ratioStaffToChildren;
    const left =
      cap -
      countActiveInWindow(
        Object.values(crecheBookings),
        crecheSessions,
        band.band,
        window.start,
        window.end,
      );
    return `${BAND_LABEL[band.band]} · ${left > 0 ? `${left} ${left === 1 ? 'place' : 'places'} left` : 'full — waitlist'}`;
  }

  function book() {
    const input =
      kind === 'dropin'
        ? { childIds: picked, dropIn: { start: window.start, hours } }
        : { childIds: picked, sessionId: sessionId(day, kind) };
    const result = dispatch('creche.book', input, { kind: 'resident', id: actorId });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const summary = result.value
      .map(
        (b) =>
          `${childrenRecord[b.childId]?.name.split(' ')[0]} ${b.state === 'confirmed' ? 'confirmed' : 'on the waitlist'}`,
      )
      .join(' · ');
    pushToast(
      slot,
      summary,
      result.value.every((b) => b.state === 'confirmed') ? 'success' : 'neutral',
    );
    pop();
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Book Kids’ Club" onBack={pop} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
        <section className="flex flex-col gap-2 pt-2">
          <h2 className="text-label-1 text-text-title">Who’s going?</h2>
          {children.map((c) => (
            <label key={c.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                className="accent-brand h-5 w-5"
                checked={picked.includes(c.id)}
                onChange={(e) =>
                  setPicked(e.target.checked ? [...picked, c.id] : picked.filter((p) => p !== c.id))
                }
              />
              <span className="text-label-2 text-text-body flex-1">{c.name.split(' ')[0]}</span>
              <span className="text-body-3 text-text-muted">{placesLeft(c.dob)}</span>
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">Day</h2>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => (
              <Chip key={d} active={day === d} onClick={() => setDay(d)}>
                {fmtDate(dubaiDateTimeToIso(d, '12:00'), 'EEE d')}
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">Session</h2>
          <div className="flex flex-wrap gap-2">
            <Chip active={kind === 'morning'} onClick={() => setKind('morning')}>
              Morning {rules.creche.sessions.morning.start}–{rules.creche.sessions.morning.end}
            </Chip>
            <Chip active={kind === 'afternoon'} onClick={() => setKind('afternoon')}>
              Afternoon {rules.creche.sessions.afternoon.start}–
              {rules.creche.sessions.afternoon.end}
            </Chip>
            <Chip active={kind === 'dropin'} onClick={() => setKind('dropin')}>
              Drop-in
            </Chip>
          </div>
          {kind === 'dropin' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {DROP_IN_STARTS.map((t) => (
                  <Chip key={t} active={dropStart === t} onClick={() => setDropStart(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
              <Stepper
                label="Hours"
                value={hours}
                min={rules.creche.sessions.dropIn.minHours}
                max={rules.creche.sessions.dropIn.maxHours}
                onChange={setHours}
              />
            </div>
          )}
        </section>

        <p className="text-body-3 text-text-muted">
          {tenant
            ? `AED ${rules.creche.tenantFeePerHourFils / 100}/hr, charged to your wallet at check-out on actual time (rounded up to ${rules.creche.feeRoundingMinutes} min).`
            : 'Free for owners.'}{' '}
          Late pickup after {rules.creche.latePickup.graceMinutes} min: AED{' '}
          {rules.creche.latePickup.feePer15MinFils / 100} per 15 min.
        </p>

        {error && <Banner style="urgent">{error}</Banner>}
        <Button fullWidth disabled={picked.length === 0} onClick={book}>
          Book
        </Button>
      </div>
    </div>
  );
}
