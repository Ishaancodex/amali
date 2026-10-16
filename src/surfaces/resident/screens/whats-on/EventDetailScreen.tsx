'use client';

/**
 * Event detail + RSVP (PRD §8.2). A showtime picker, attendee steppers
 * (household / guest adult / guest child, capped at the venue's guest
 * limit), a seat grid for the Screening Room, then one `rsvp.bookNow` call
 * — the same two-step `rsvp.hold` → `rsvp.confirm` architecture exists and
 * is exercised by `tests/unit/events-commands.test.ts` and S3, but this
 * screen books in one step like `PadelBookScreen` (P3) does, rather than
 * surfacing its own hold-countdown UI — the same scope cut, for the same
 * reason, as padel's.
 *
 * Attendees besides the booker get generic names ("Household 1", "Guest
 * 1") — there's no per-attendee name field in this phase's UI.
 */
import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Stepper } from '@/ui/Stepper';
import { Banner } from '@/ui/Banner';
import { Tag } from '@/ui/Tag';
import { CheckCircle2 } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { fmtDate, fmtTime } from '@/lib/time';
import { allSeatIds, confirmedSeats, heldSeats } from '@/domain/events/seats';
import { rsvpsForShowtime } from '@/domain/events/capacity';
import { partyFeeFils } from '@/domain/events/pricing';
import type { DeviceSlotId } from '@/types/demo';
import type { AttendeeCategory } from '@/types/event';
import type { Rsvp } from '@/types/event';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'full'; message: string }
  | { kind: 'success'; rsvp: Rsvp };

export function EventDetailScreen({
  slot,
  eventId,
  showtimeId: initialShowtimeId,
}: {
  slot: DeviceSlotId;
  eventId: string;
  showtimeId?: string;
}) {
  const { pop, replace } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const event = useStore((s) => s.events[eventId]);
  const showtimesRecord = useStore((s) => s.showtimes);
  const rsvpsRecord = useStore((s) => s.rsvps);
  const dispatch = useStore((s) => s.dispatch);

  const showtimes = Object.values(showtimesRecord)
    .filter((sh) => sh.eventId === eventId && sh.state !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start));

  const [showtimeId, setShowtimeId] = useState(initialShowtimeId ?? showtimes[0]?.id);
  const [household, setHousehold] = useState(0);
  const [guestAdult, setGuestAdult] = useState(0);
  const [guestChild, setGuestChild] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });

  const showtime = showtimeId ? showtimesRecord[showtimeId] : undefined;

  const myRsvp = useMemo(
    () =>
      showtimeId
        ? Object.values(rsvpsRecord).find(
            (r) =>
              r.showtimeId === showtimeId &&
              r.bookerId === resident?.id &&
              (r.state === 'confirmed' || r.state === 'held'),
          )
        : undefined,
    [rsvpsRecord, showtimeId, resident?.id],
  );

  const attendeeCategories: AttendeeCategory[] = [
    'resident',
    ...Array.from({ length: household }, () => 'household' as const),
    ...Array.from({ length: guestAdult }, () => 'guest_adult' as const),
    ...Array.from({ length: guestChild }, () => 'guest_child' as const),
  ];
  const totalAttendees = attendeeCategories.length;

  // Trim any now-extra seats and clear a stale error/full banner whenever the party size changes.
  useEffect(() => {
    setSelectedSeats((prev) =>
      prev.length > totalAttendees ? prev.slice(0, totalAttendees) : prev,
    );
    setSubmit((prev) => (prev.kind === 'idle' ? prev : { kind: 'idle' }));
  }, [totalAttendees]);

  if (!event || !resident) return null;
  const me = resident;

  const venueRules = event.venue === 'music' ? rules.music : rules.screening;
  const maxCombinedGuests = venueRules.maxGuestsPerUnitPerShowtime;
  const childrenAllowed = event.ageRating !== 'PG-13' && event.ageRating !== '18+';
  const feeFils = partyFeeFils(
    attendeeCategories.map((category) => ({ category })),
    event.pricing,
  );

  const isSeatMode = showtime?.capacityMode === 'seats';
  const showtimeRsvps = showtime ? rsvpsForShowtime(Object.values(rsvpsRecord), showtime.id) : [];
  const takenSeats = showtime
    ? new Set([
        ...confirmedSeats(showtimeRsvps),
        ...heldSeats(showtimeRsvps),
        ...showtime.blockedSeats,
      ])
    : new Set<string>();

  function toggleSeat(seatId: string) {
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) return prev.filter((s) => s !== seatId);
      if (prev.length >= totalAttendees) return prev;
      return [...prev, seatId];
    });
  }

  function attendeeInputs() {
    let householdN = 0;
    let guestAdultN = 0;
    let guestChildN = 0;
    return attendeeCategories.map((category, i) => {
      const seat = isSeatMode ? selectedSeats[i] : undefined;
      if (category === 'resident') return { category, name: me.name, seat };
      if (category === 'household') return { category, name: `Household ${++householdN}`, seat };
      if (category === 'guest_adult') return { category, name: `Guest ${++guestAdultN}`, seat };
      return { category, name: `Child guest ${++guestChildN}`, seat };
    });
  }

  function handleBook() {
    if (!showtimeId) return;
    if (isSeatMode && selectedSeats.length !== totalAttendees) {
      setSubmit({ kind: 'error', message: 'Choose one seat per attendee.' });
      return;
    }
    const result = dispatch(
      'rsvp.bookNow',
      { showtimeId, attendees: attendeeInputs() },
      { kind: 'resident', id: me.id },
    );
    if (result.ok) {
      setSubmit({ kind: 'success', rsvp: result.value });
    } else if (result.error.code === 'SHOWTIME_FULL' || result.error.code === 'SHOWTIME_HELD') {
      setSubmit({ kind: 'full', message: result.error.message });
    } else {
      setSubmit({ kind: 'error', message: result.error.message });
    }
  }

  function handleJoinWaitlist() {
    if (!showtimeId) return;
    const result = dispatch(
      'eventWaitlist.join',
      { showtimeId, partySize: totalAttendees },
      { kind: 'resident', id: me.id },
    );
    if (result.ok) {
      replace('whats-on');
    } else {
      setSubmit({ kind: 'error', message: result.error.message });
    }
  }

  function handleCancelRsvp() {
    if (!myRsvp) return;
    dispatch('rsvp.cancel', { rsvpId: myRsvp.id }, { kind: 'resident', id: me.id });
  }

  if (submit.kind === 'success') {
    return (
      <div className="flex h-full flex-col">
        <TopBar title="RSVP confirmed" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <CheckCircle2 className="text-success h-14 w-14" strokeWidth={1.5} />
          <p className="text-title-l text-text-title">You&apos;re on the list</p>
          {showtime && (
            <p className="text-body-2 text-text-muted">
              {fmtDate(showtime.start)} · {fmtTime(showtime.start)}
            </p>
          )}
          <Button fullWidth onClick={() => replace('whats-on')}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={event.title} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mt-4 flex items-center gap-2">
          <Tag variant="brand">{event.venue === 'screening' ? 'Screening Room' : 'Music Room'}</Tag>
          <Tag variant="info">{event.ageRating}</Tag>
        </div>
        <p className="text-body-2 text-text-body mt-3">{event.description}</p>

        {myRsvp && (
          <div className="mt-4">
            <Banner style="success">
              You&apos;re {myRsvp.state === 'held' ? 'holding a spot' : 'going'} —{' '}
              {myRsvp.attendees.length} attendee
              {myRsvp.attendees.length === 1 ? '' : 's'}.
            </Banner>
            {myRsvp.state === 'confirmed' && (
              <Button variant="destructive" fullWidth className="mt-3" onClick={handleCancelRsvp}>
                Cancel RSVP
              </Button>
            )}
          </div>
        )}

        {!myRsvp && (
          <>
            <h2 className="text-label-1 text-text-title mt-5 mb-2">Showtime</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {showtimes.map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => {
                    setShowtimeId(sh.id);
                    setSelectedSeats([]);
                    setSubmit({ kind: 'idle' });
                  }}
                  className={`rounded-input text-body-3 shrink-0 border px-3 py-2 text-center ${
                    sh.id === showtimeId
                      ? 'bg-brand text-on-brand border-brand'
                      : 'border-border-card text-text-body'
                  }`}
                >
                  {fmtDate(sh.start, 'EEE d MMM')} · {fmtTime(sh.start)}
                </button>
              ))}
            </div>

            <h2 className="text-label-1 text-text-title mt-5 mb-2">Who&apos;s coming</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-body-2 text-text-body">You</span>
                <span className="text-label-2 text-text-muted">1</span>
              </div>
              <Stepper
                label="Household members"
                value={household}
                min={0}
                max={6}
                onChange={setHousehold}
              />
              <Stepper
                label="Guest adults"
                value={guestAdult}
                min={0}
                max={maxCombinedGuests - guestChild}
                onChange={setGuestAdult}
              />
              {childrenAllowed && (
                <Stepper
                  label="Guest children"
                  value={guestChild}
                  min={0}
                  max={maxCombinedGuests - guestAdult}
                  onChange={setGuestChild}
                />
              )}
            </div>

            {isSeatMode && showtime && (
              <>
                <h2 className="text-label-1 text-text-title mt-5 mb-2">
                  Choose {totalAttendees} seat{totalAttendees === 1 ? '' : 's'}
                </h2>
                <div className="grid grid-cols-6 gap-1.5">
                  {allSeatIds().map((seatId) => {
                    const taken = takenSeats.has(seatId);
                    const selected = selectedSeats.includes(seatId);
                    return (
                      <button
                        key={seatId}
                        type="button"
                        disabled={taken}
                        onClick={() => toggleSeat(seatId)}
                        className={`text-body-3 rounded-[6px] border py-1.5 text-center tabular-nums disabled:cursor-not-allowed disabled:opacity-30 ${
                          selected
                            ? 'bg-brand text-on-brand border-brand'
                            : 'border-border-card text-text-body'
                        }`}
                      >
                        {seatId}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {feeFils > 0 && (
              <p className="text-body-3 text-text-muted mt-4">
                AED {feeFils / 100} guest fee, charged on RSVP.
              </p>
            )}

            {submit.kind === 'error' && (
              <div className="mt-4">
                <Banner style="warning">{submit.message}</Banner>
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
              <Button fullWidth disabled={!showtimeId} onClick={handleBook}>
                RSVP
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
