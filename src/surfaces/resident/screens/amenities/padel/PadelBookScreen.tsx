'use client';

/**
 * Padel booking (PRD §7, §8.1). Picks a date (7-day rolling window),
 * duration, a 30-minute-grid start, and up to 2 guests, then books in one
 * step via `booking.bookNow` — the real two-step `booking.hold` →
 * `booking.confirm` architecture exists and is exercised by
 * `tests/unit/booking-commands.test.ts` and S1/S2, but this screen doesn't
 * yet surface the hold countdown (PRD §7's visible 180s ring) as its own
 * UI moment; a deliberate scope cut for this phase, not a missing command.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Stepper } from '@/ui/Stepper';
import { Banner } from '@/ui/Banner';
import { ConfirmedMark, Ticket } from '@/ui/ConfirmedMark';
import { Shake } from '@/ui/Shake';
import { motion } from 'motion/react';
import { fadeUp, staggerDelay } from '@/design/motion';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { addDaysIso, addHoursIso, dubaiDateKey } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { slotOptions } from '@/domain/booking/slots';
import type { DeviceSlotId } from '@/types/demo';
import type { Booking } from '@/types/booking';
import { FillChip, SlotChip } from './parts/SlotChips';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string; alternatives?: string[] }
  | { kind: 'full'; message: string }
  | { kind: 'success'; booking: Booking };

export function PadelBookScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { pop, replace } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const now = useStore((s) => s.demo.clock.now);
  const bookingsRecord = useStore((s) => s.bookings);
  const blackoutsRecord = useStore((s) => s.blackouts);
  const dispatch = useStore((s) => s.dispatch);

  const todayKey = dubaiDateKey(now);
  const dateOptions = Array.from({ length: rules.padel.bookingWindowDays }, (_, i) =>
    dubaiDateKey(addDaysIso(now, i)),
  );

  const [dateKey, setDateKey] = useState(todayKey);
  const [duration, setDuration] = useState<60 | 90>(60);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [guestCount, setGuestCount] = useState(0);
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });

  if (!resident) return null;

  const padelBookings = Object.values(bookingsRecord).filter(
    (b) =>
      b.amenity === 'padel' &&
      (b.state === 'held' || b.state === 'confirmed' || b.state === 'checked_in'),
  );

  const earliestBookable = addHoursIso(now, rules.padel.leadTimeHours);
  const slots = slotOptions({
    dateKey,
    durationMinutes: duration,
    earliestBookable,
    bookings: padelBookings,
    blackouts: Object.values(blackoutsRecord).filter((b) => b.amenity === 'padel'),
  });
  const clinic = slots.find((s) => s.blackoutReason)?.blackoutReason;

  const guests = Array.from({ length: guestCount }, (_, i) => ({
    guestName: t('padel.guestName', { n: i + 1 }),
    guestPhone: '+971500000000',
  }));
  const feeFils = guestCount * rules.padel.guestFeeFils;

  function handleBook() {
    if (!start) return;
    setSubmit({ kind: 'idle' });
    const result = dispatch(
      'booking.bookNow',
      { start, durationMinutes: duration, players: guests },
      { kind: 'resident', id: resident!.id },
    );
    if (result.ok) {
      setSubmit({ kind: 'success', booking: result.value });
    } else if (result.error.code === 'SLOT_FULL' || result.error.code === 'SLOT_HELD') {
      setSubmit({ kind: 'full', message: errorText(result.error) });
    } else {
      setSubmit({
        kind: 'error',
        message: errorText(result.error),
        alternatives: (result.error.alternatives as string[] | undefined)?.slice(0, 3),
      });
    }
  }

  function handleJoinWaitlist() {
    if (!start) return;
    const result = dispatch('waitlist.join', { start }, { kind: 'resident', id: resident!.id });
    if (result.ok) {
      replace('amenity-detail', { key: 'padel' });
    } else {
      setSubmit({ kind: 'error', message: errorText(result.error) });
    }
  }

  if (submit.kind === 'success') {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t('padel.confirmedTitle')} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <ConfirmedMark />
          <p className="text-title-l text-text-title">{t('padel.booked_title')}</p>
          <Ticket>
            <p className="text-body-2 text-text-muted">
              {fmt.date(submit.booking.start)} · {fmt.time(submit.booking.start)}–
              {fmt.time(submit.booking.end)}
            </p>
          </Ticket>
          <Button fullWidth onClick={() => replace('amenity-detail', { key: 'padel' })}>
            {t('common.done')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('padel.bookTitle')} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <h2 className="text-label-1 text-text-title mt-4 mb-2">{t('padel.date')}</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dateOptions.map((d) => (
            <FillChip
              key={d}
              selected={d === dateKey}
              onClick={() => {
                setDateKey(d);
                setStart(undefined);
              }}
              className="text-body-3 shrink-0 px-3 py-2"
            >
              {fmt.dateKey(d, 'EEE d')}
            </FillChip>
          ))}
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">{t('padel.duration')}</h2>
        <div className="flex gap-2">
          {rules.padel.durationsMinutes.map((m) => (
            <FillChip
              key={m}
              selected={m === duration}
              onClick={() => {
                setDuration(m as 60 | 90);
                setStart(undefined);
              }}
              className="text-body-2 flex-1 py-2"
            >
              {t('common.minutes', { count: m })}
            </FillChip>
          ))}
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">{t('padel.time')}</h2>
        {clinic && (
          <p className="text-body-3 text-text-muted mb-2">
            {t('padel.closedFor', { reason: clinic })}
          </p>
        )}
        <div className="grid grid-cols-4 gap-2">
          {slots.map(({ start: s, bookable }) => (
            <SlotChip
              key={s}
              bookable={bookable}
              selected={s === start}
              onClick={() => setStart(s)}
            >
              {fmt.time(s)}
            </SlotChip>
          ))}
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">{t('padel.guests')}</h2>
        <Stepper
          value={guestCount}
          min={0}
          max={rules.padel.maxGuestsPerBooking}
          onChange={setGuestCount}
          label={t('padel.guests')}
        />
        {feeFils > 0 && (
          <p className="text-body-3 text-text-muted mt-1">
            {t('padel.guestFee', { amount: fmt.aed(feeFils) })}
          </p>
        )}

        {submit.kind === 'error' && (
          <div className="mt-4">
            <Shake trigger={submit.message}>
              <Banner style="warning">{submit.message}</Banner>
            </Shake>
            {submit.alternatives && submit.alternatives.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {submit.alternatives.map((alt, i) => (
                  <motion.button
                    key={alt}
                    variants={fadeUp}
                    initial="initial"
                    animate="animate"
                    transition={{ delay: staggerDelay(i) }}
                    type="button"
                    onClick={() => {
                      setDateKey(dubaiDateKey(alt));
                      setStart(alt);
                      setSubmit({ kind: 'idle' });
                    }}
                    className="rounded-tag bg-brand-tint text-brand text-label-3 px-3 py-1.5"
                  >
                    {fmt.date(alt)} {fmt.time(alt)}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {submit.kind === 'full' && (
          <div className="mt-4 flex flex-col gap-2">
            <Banner style="info">{submit.message}</Banner>
            <Button variant="secondary" fullWidth onClick={handleJoinWaitlist}>
              {t('padel.joinWaitlist')}
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Button fullWidth disabled={!start} onClick={handleBook}>
            {start ? t('padel.bookAt', { time: fmt.time(start) }) : t('padel.chooseTime')}
          </Button>
        </div>
      </div>
    </div>
  );
}
