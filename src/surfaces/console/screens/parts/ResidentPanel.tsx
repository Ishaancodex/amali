'use client';

/**
 * One resident, from the console: details by role (with the logged
 * Reveal), their upcoming padel bookings (cancel on behalf), and "Book
 * padel on behalf" — every on-behalf action needs a reason and is logged.
 */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Banner } from '@/ui/Banner';
import { Eye } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { residentView } from '@/domain/rbac/pii';
import { slotOptions } from '@/domain/booking/slots';
import { addDaysIso, addHoursIso, dubaiDateKey } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { cn } from '@/lib/cn';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../../useConsoleActor';

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-tag text-label-3 px-2.5 py-1 disabled:opacity-30',
        active ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
      )}
    >
      {children}
    </button>
  );
}

export function ResidentPanel({ slot, residentId }: { slot: DeviceSlotId; residentId: string }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { actor, consoleRole, assignedAmenities } = useConsoleActor(slot);
  const resident = useStore((s) => s.residents[residentId]);
  const bookingsRecord = useStore((s) => s.bookings);
  const blackouts = useStore((s) => s.blackouts);
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [revealed, setRevealed] = useState(false);
  const [reason, setReason] = useState('');
  const [day, setDay] = useState(dubaiDateKey(now));
  const [start, setStart] = useState<string | undefined>();
  const [duration, setDuration] = useState<60 | 90>(60);
  const [error, setError] = useState<string | undefined>();

  if (!resident || !actor || !consoleRole) return null;
  const view = residentView(resident, consoleRole, revealed);
  const active = Object.values(bookingsRecord).filter(
    (b) => b.state === 'confirmed' || b.state === 'checked_in' || b.state === 'held',
  );
  const upcoming = active
    .filter((b) => b.bookerId === resident.id && b.end > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const days = Array.from({ length: rules.padel.bookingWindowDays }, (_, i) =>
    dubaiDateKey(addDaysIso(now, i)),
  );
  const slots = slotOptions({
    dateKey: day,
    durationMinutes: duration,
    earliestBookable: addHoursIso(now, rules.padel.leadTimeHours),
    bookings: active,
    blackouts: Object.values(blackouts).filter((b) => b.amenity === 'padel'),
  });
  const opts = { assignedAmenities };

  function reveal() {
    const result = dispatch('pii.reveal', { residentId, field: 'phone' }, actor!, opts);
    if (result.ok) setRevealed(true);
    pushToast(
      slot,
      result.ok ? t('console.residents.revealed') : errorText(result.error),
      result.ok ? 'neutral' : 'error',
    );
  }

  function book() {
    if (!start) return;
    const result = dispatch(
      'booking.bookOnBehalf',
      { residentId, start, durationMinutes: duration, players: [], reason },
      actor!,
      opts,
    );
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    setError(undefined);
    setStart(undefined);
    setReason('');
    pushToast(
      slot,
      t('console.residents.booked', {
        name: resident!.name.split(' ')[0],
        date: fmt.dateTime(result.value.start),
      }),
      'success',
    );
  }

  function cancel(bookingId: string) {
    const result = dispatch('booking.cancelOnBehalf', { bookingId, reason }, actor!, opts);
    if (!result.ok) setError(errorText(result.error));
    else pushToast(slot, t('console.residents.cancelled'), 'success');
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p className="text-title-l text-text-title">{view.name}</p>
        <p className="text-body-2 text-text-body">
          {t('console.residents.unit')} <bdi>{view.unitId}</bdi>
        </p>
        {view.phone && (
          <p className="text-body-2 text-text-body flex items-center gap-2">
            <bdi>{view.phone}</bdi>
            {view.canReveal && (
              <Button variant="tertiary" onClick={reveal}>
                <Eye className="me-1 inline h-4 w-4" strokeWidth={1.5} />
                {t('console.residents.reveal')}
              </Button>
            )}
          </p>
        )}
        {view.email && (
          <p className="text-body-2 text-text-body">
            <bdi>{view.email}</bdi>
          </p>
        )}
      </Card>

      <Input
        label={t('console.residents.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('console.residents.reasonHint')}
      />
      {error && <Banner style="urgent">{error}</Banner>}

      <Card className="flex flex-col gap-3">
        <h2 className="text-label-1 text-text-title">{t('console.residents.padelBookings')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-body-3 text-text-muted">{t('console.residents.noUpcoming')}</p>
        ) : (
          upcoming.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2">
              <span className="text-body-2 text-text-body">
                {fmt.dateTime(b.start)}–{fmt.time(b.end)}
                {b.source === 'agent' ? ` · ${t('console.residents.byStaff')}` : ''}
              </span>
              <Button variant="destructive" disabled={!reason.trim()} onClick={() => cancel(b.id)}>
                {t('console.residents.cancelOnBehalf')}
              </Button>
            </div>
          ))
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-label-1 text-text-title">{t('console.residents.bookOnBehalf')}</h2>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => (
            <Chip
              key={d}
              active={day === d}
              onClick={() => {
                setDay(d);
                setStart(undefined);
              }}
            >
              {fmt.dateKey(d, 'EEE d')}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5">
          {([60, 90] as const).map((m) => (
            <Chip
              key={m}
              active={duration === m}
              onClick={() => {
                setDuration(m);
                setStart(undefined);
              }}
            >
              {t('common.minutes', { count: m })}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <Chip
              key={s.start}
              active={start === s.start}
              disabled={!s.bookable}
              onClick={() => setStart(s.start)}
            >
              {fmt.time(s.start)}
            </Chip>
          ))}
        </div>
        <Button disabled={!start || !reason.trim()} onClick={book}>
          {reason.trim()
            ? start
              ? t('console.residents.bookFor', {
                  time: fmt.time(start),
                  name: resident.name.split(' ')[0],
                })
              : t('padel.chooseTime')
            : t('console.residents.reasonFirst')}
        </Button>
      </Card>
    </div>
  );
}
