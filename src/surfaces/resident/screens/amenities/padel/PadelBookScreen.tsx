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
import { CheckCircle2 } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import {
  addDaysIso,
  addHoursIso,
  dubaiDateKey,
  dubaiDateTimeToIso,
  fmtDate,
  fmtTime,
  isAfterIso,
} from '@/lib/time';
import { gridStartsForDate, slotEnd, slotsOverlap } from '@/domain/booking/slots';
import type { DeviceSlotId } from '@/types/demo';
import type { Booking } from '@/types/booking';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string; alternatives?: string[] }
  | { kind: 'full'; message: string }
  | { kind: 'success'; booking: Booking };

export function PadelBookScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop, replace } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const now = useStore((s) => s.demo.clock.now);
  const bookingsRecord = useStore((s) => s.bookings);
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
  const closeIso = dubaiDateTimeToIso(dateKey, rules.padel.operatingHours.close);
  const slots = gridStartsForDate(dateKey)
    .filter((s) => s >= dubaiDateTimeToIso(dateKey, rules.padel.operatingHours.open))
    .filter((s) => slotEnd(s, duration) <= closeIso)
    .map((s) => ({
      start: s,
      bookable:
        isAfterIso(s, earliestBookable) &&
        !padelBookings.some((b) => slotsOverlap(s, slotEnd(s, duration), b.start, b.end)),
    }));

  const guests = Array.from({ length: guestCount }, (_, i) => ({
    guestName: `Guest ${i + 1}`,
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
      setSubmit({ kind: 'full', message: result.error.message });
    } else {
      setSubmit({
        kind: 'error',
        message: result.error.message,
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
      setSubmit({ kind: 'error', message: result.error.message });
    }
  }

  if (submit.kind === 'success') {
    return (
      <div className="flex h-full flex-col">
        <TopBar title="Booking confirmed" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <CheckCircle2 className="text-success h-14 w-14" strokeWidth={1.5} />
          <p className="text-title-l text-text-title">Padel court booked</p>
          <p className="text-body-2 text-text-muted">
            {fmtDate(submit.booking.start)} · {fmtTime(submit.booking.start)}–
            {fmtTime(submit.booking.end)}
          </p>
          <Button fullWidth onClick={() => replace('amenity-detail', { key: 'padel' })}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Book Padel" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <h2 className="text-label-1 text-text-title mt-4 mb-2">Date</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dateOptions.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDateKey(d);
                setStart(undefined);
              }}
              className={`rounded-input text-body-3 shrink-0 border px-3 py-2 text-center ${
                d === dateKey
                  ? 'bg-brand text-on-brand border-brand'
                  : 'border-border-card text-text-body'
              }`}
            >
              {fmtDate(dubaiDateTimeToIso(d, '12:00'), 'EEE d')}
            </button>
          ))}
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">Duration</h2>
        <div className="flex gap-2">
          {rules.padel.durationsMinutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDuration(m as 60 | 90);
                setStart(undefined);
              }}
              className={`rounded-input text-body-2 flex-1 border py-2 text-center ${
                m === duration
                  ? 'bg-brand text-on-brand border-brand'
                  : 'border-border-card text-text-body'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">Time</h2>
        <div className="grid grid-cols-4 gap-2">
          {slots.map(({ start: s, bookable }) => (
            <button
              key={s}
              type="button"
              disabled={!bookable}
              onClick={() => setStart(s)}
              className={`rounded-input text-body-3 border py-2 text-center tabular-nums disabled:cursor-not-allowed disabled:opacity-30 ${
                s === start
                  ? 'bg-brand text-on-brand border-brand'
                  : 'border-border-card text-text-body'
              }`}
            >
              {fmtTime(s)}
            </button>
          ))}
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">Guests</h2>
        <Stepper
          value={guestCount}
          min={0}
          max={rules.padel.maxGuestsPerBooking}
          onChange={setGuestCount}
          label="Guests"
        />
        {feeFils > 0 && (
          <p className="text-body-3 text-text-muted mt-1">
            AED {feeFils / 100} guest fee, charged on booking.
          </p>
        )}

        {submit.kind === 'error' && (
          <div className="mt-4">
            <Banner style="warning">{submit.message}</Banner>
            {submit.alternatives && submit.alternatives.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {submit.alternatives.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => {
                      setDateKey(dubaiDateKey(alt));
                      setStart(alt);
                      setSubmit({ kind: 'idle' });
                    }}
                    className="rounded-tag bg-brand-tint text-brand text-label-3 px-3 py-1.5"
                  >
                    {fmtDate(alt)} {fmtTime(alt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {submit.kind === 'full' && (
          <div className="mt-4 flex flex-col gap-2">
            <Banner style="info">{submit.message}</Banner>
            <Button variant="secondary" fullWidth onClick={handleJoinWaitlist}>
              Join waitlist
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Button fullWidth disabled={!start} onClick={handleBook}>
            {start ? `Book ${fmtTime(start)}` : 'Choose a time'}
          </Button>
        </div>
      </div>
    </div>
  );
}
