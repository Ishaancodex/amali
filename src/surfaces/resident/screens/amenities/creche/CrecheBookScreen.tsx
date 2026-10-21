'use client';

/**
 * Book the Kids' Club (PRD §8.3): pick the children (siblings book
 * together, each against their own band), a day in the 7-day window, and
 * the morning or afternoon session or an hourly drop-in block. A full band
 * offers the waitlist rather than refusing.
 */
import { useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { SectionHeading } from '@/ui/SectionHeading';
import { Chip } from '@/ui/Chip';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Stepper } from '@/ui/Stepper';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { bandForChild } from '@/domain/creche/bands';
import { countActiveInWindow, staffOnBand } from '@/domain/creche/capacity';
import { crecheSessionId as sessionId } from '@/domain/creche/sessionIds';
import { addDaysIso, addHoursIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
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

export function CrecheBookScreen({ slot, childId }: { slot: DeviceSlotId; childId?: string }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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
    if (!band.ok || !window.start)
      return band.ok
        ? ''
        : t(`kids.bandReason.${band.reason}`, { age: rules.creche.minAcceptedAge });
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
    return `${t(`kids.band.${band.band}`)} · ${left > 0 ? t('kids.placesLeft', { count: left }) : t('kids.fullWaitlist')}`;
  }

  function book() {
    const input =
      kind === 'dropin'
        ? { childIds: picked, dropIn: { start: window.start, hours } }
        : { childIds: picked, sessionId: sessionId(day, kind) };
    const result = dispatch('creche.book', input, { kind: 'resident', id: actorId });
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    const summary = result.value
      .map((b) =>
        t(b.state === 'confirmed' ? 'kids.bookedConfirmed' : 'kids.bookedWaitlist', {
          name: childrenRecord[b.childId]?.name.split(' ')[0],
        }),
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
    <ScreenShell
      eyebrow={t('resident.home.quick.kidsClub')}
      title={t('kids.bookTitle')}
      onBack={pop}
      image="/amenities/creche.jpg"
      bodyClassName="gap-6"
      footer={
        <div className="border-border-card bg-pearl-glass shrink-0 border-t-[0.5px] px-4 py-3 backdrop-blur-xl">
          <Button fullWidth disabled={picked.length === 0} onClick={book}>
            {t('ui.book')}
          </Button>
        </div>
      }
    >
      <section className="flex flex-col gap-2">
        <SectionHeading title={t('kids.whosGoing')} />
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
            <span className="text-label-2 text-text-title flex-1">{c.name.split(' ')[0]}</span>
            <span className="text-body-3 text-text-muted">{placesLeft(c.dob)}</span>
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading title={t('kids.day')} />
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Chip key={d} active={day === d} onClick={() => setDay(d)}>
              {fmt.dateKey(d, 'EEE d')}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading title={t('kids.session')} />
        <div className="flex flex-wrap gap-2">
          <Chip active={kind === 'morning'} onClick={() => setKind('morning')}>
            {t('kids.morning', rules.creche.sessions.morning)}
          </Chip>
          <Chip active={kind === 'afternoon'} onClick={() => setKind('afternoon')}>
            {t('kids.afternoon', rules.creche.sessions.afternoon)}
          </Chip>
          <Chip active={kind === 'dropin'} onClick={() => setKind('dropin')}>
            {t('kids.dropIn')}
          </Chip>
        </div>
        {kind === 'dropin' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {DROP_IN_STARTS.map((time) => (
                <Chip key={time} active={dropStart === time} onClick={() => setDropStart(time)}>
                  {time}
                </Chip>
              ))}
            </div>
            <Stepper
              label={t('kids.hours')}
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
          ? t('kids.tenantFee', {
              amount: fmt.aed(rules.creche.tenantFeePerHourFils),
              rounding: rules.creche.feeRoundingMinutes,
            })
          : t('kids.ownersFree')}{' '}
        {t('kids.lateFee', {
          grace: rules.creche.latePickup.graceMinutes,
          amount: fmt.aed(rules.creche.latePickup.feePer15MinFils),
        })}
      </p>

      {error && <Banner style="urgent">{error}</Banner>}
    </ScreenShell>
  );
}
