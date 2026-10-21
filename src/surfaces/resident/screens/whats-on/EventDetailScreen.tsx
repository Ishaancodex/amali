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
import { ScreenShell } from '@/ui/ScreenShell';
import { SectionHeading } from '@/ui/SectionHeading';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Tag } from '@/ui/Tag';
import { Shake } from '@/ui/Shake';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { confirmedSeats, heldSeats } from '@/domain/events/seats';
import { rsvpsForShowtime } from '@/domain/events/capacity';
import { partyFeeFils } from '@/domain/events/pricing';
import type { DeviceSlotId } from '@/types/demo';
import type { AttendeeCategory } from '@/types/event';
import type { Rsvp } from '@/types/event';
import { SeatGrid } from './parts/SeatGrid';
import { PartySteppers, ShowtimePicker, type Party } from './parts/RsvpParty';
import { MyRsvp, RsvpConfirmed } from './parts/RsvpStatus';

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
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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
  const [party, setParty] = useState<Party>({ household: 0, guestAdult: 0, guestChild: 0 });
  const { household, guestAdult, guestChild } = party;
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
      if (category === 'household')
        return { category, name: t('events.attendee.household', { n: ++householdN }), seat };
      if (category === 'guest_adult')
        return { category, name: t('events.attendee.guest', { n: ++guestAdultN }), seat };
      return { category, name: t('events.attendee.child', { n: ++guestChildN }), seat };
    });
  }

  function handleBook() {
    if (!showtimeId) return;
    if (isSeatMode && selectedSeats.length !== totalAttendees) {
      setSubmit({ kind: 'error', message: t('events.seatPerAttendee') });
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
      setSubmit({ kind: 'full', message: errorText(result.error) });
    } else {
      setSubmit({ kind: 'error', message: errorText(result.error) });
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
      setSubmit({ kind: 'error', message: errorText(result.error) });
    }
  }

  function handleCancelRsvp() {
    if (!myRsvp) return;
    dispatch('rsvp.cancel', { rsvpId: myRsvp.id }, { kind: 'resident', id: me.id });
  }

  if (submit.kind === 'success') {
    return (
      <RsvpConfirmed showtime={showtime} image={event.poster} onDone={() => replace('whats-on')} />
    );
  }

  return (
    <ScreenShell
      eyebrow={t(`amenity.${event.venue}.name`)}
      title={event.title}
      onBack={pop}
      image={event.poster}
      tall
      bodyClassName="gap-6"
      footer={
        !myRsvp ? (
          <div className="border-border-card bg-pearl-glass shrink-0 border-t-[0.5px] px-4 py-3 backdrop-blur-xl">
            <Button fullWidth disabled={!showtimeId} onClick={handleBook}>
              {t('events.rsvp')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex items-center gap-2">
        <Tag variant="brand">{t(`amenity.${event.venue}.name`)}</Tag>
        <Tag variant="info">{event.ageRating}</Tag>
      </div>
      <p className="text-body-2 text-text-body -mt-2">{event.description}</p>

      {myRsvp && <MyRsvp rsvp={myRsvp} onCancel={handleCancelRsvp} />}

      {!myRsvp && (
        <>
          <ShowtimePicker
            showtimes={showtimes}
            value={showtimeId}
            onChange={(id) => {
              setShowtimeId(id);
              setSelectedSeats([]);
              setSubmit({ kind: 'idle' });
            }}
          />
          <PartySteppers
            value={party}
            onChange={setParty}
            maxGuests={maxCombinedGuests}
            childrenAllowed={childrenAllowed}
          />

          {isSeatMode && showtime && (
            <section>
              <SectionHeading title={t('events.chooseSeats', { count: totalAttendees })} />
              <SeatGrid taken={takenSeats} selected={selectedSeats} onToggle={toggleSeat} />
            </section>
          )}

          {feeFils > 0 && (
            <p className="text-body-3 text-text-muted">
              {t('events.guestFee', { amount: fmt.aed(feeFils) })}
            </p>
          )}

          {submit.kind === 'error' && (
            <Shake trigger={submit.message}>
              <Banner style="warning">{submit.message}</Banner>
            </Shake>
          )}

          {submit.kind === 'full' && (
            <div className="flex flex-col gap-2">
              <Banner style="info">{submit.message}</Banner>
              <Button variant="secondary" fullWidth onClick={handleJoinWaitlist}>
                {t('padel.joinWaitlist')}
              </Button>
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}
