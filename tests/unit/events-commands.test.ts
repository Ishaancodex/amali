import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, UNIT_IDS, STAFF_IDS } from '@/seed/personaIds';
import { addHoursIso, addMinutesIso } from '@/lib/time';

const NOW = '2026-10-14T13:30:00.000Z'; // DEMO_START_ISO
const SHOWTIME_START = '2026-10-16T18:00:00.000Z'; // ~2 days out
const SHOWTIME_END = addHoursIso(SHOWTIME_START, 2);

function resetStore(now = NOW): void {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
}

function resident(personaKey: keyof typeof PERSONA_IDS) {
  return { kind: 'resident' as const, id: PERSONA_IDS[personaKey] };
}

const manager = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };

function createScreeningEvent(overrides: { capacity?: number } = {}) {
  const result = useStore.getState().dispatch(
    'event.create',
    {
      title: 'Family Movie Night',
      venue: 'screening',
      type: 'movie',
      poster: '',
      description: 'A family movie night.',
      ageRating: 'PG',
      durationMins: 120,
      pricing: { resident: 0, household: 0, guest_adult: 2500, guest_child: 1500 },
      showtimes: [
        {
          start: SHOWTIME_START,
          end: SHOWTIME_END,
          regOpens: NOW,
          regCloses: addHoursIso(SHOWTIME_START, -1),
          capacity: overrides.capacity ?? 22,
          capacityMode: 'seats',
        },
      ],
    },
    manager,
  );
  if (!result.ok) throw new Error('event.create failed: ' + JSON.stringify(result.error));
  const showtimeId = Object.values(useStore.getState().showtimes).find(
    (s) => s.eventId === result.value.id,
  )!.id;
  return { event: result.value, showtimeId };
}

describe('event lifecycle commands', () => {
  beforeEach(() => resetStore());

  it('creates a draft event with its showtimes, then publishes it', () => {
    const { event, showtimeId } = createScreeningEvent();
    expect(event.lifecycle).toBe('draft');
    expect(useStore.getState().showtimes[showtimeId]?.state).toBe('open');

    const published = useStore.getState().dispatch('event.publish', { eventId: event.id }, manager);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.value.lifecycle).toBe('published');
    expect(published.value.publishAt).toBe(NOW);
  });

  it('blocks two overlapping showtimes in the same venue at creation', () => {
    const result = useStore.getState().dispatch(
      'event.create',
      {
        title: 'Double Feature',
        venue: 'screening',
        type: 'movie',
        poster: '',
        description: '',
        ageRating: 'PG',
        durationMins: 120,
        pricing: { resident: 0, household: 0, guest_adult: 2500, guest_child: 1500 },
        showtimes: [
          {
            start: SHOWTIME_START,
            end: SHOWTIME_END,
            regOpens: NOW,
            regCloses: SHOWTIME_START,
            capacity: 22,
            capacityMode: 'seats',
          },
          {
            start: addMinutesIso(SHOWTIME_START, 30),
            end: addMinutesIso(SHOWTIME_END, 30),
            regOpens: NOW,
            regCloses: SHOWTIME_START,
            capacity: 22,
            capacityMode: 'seats',
          },
        ],
      },
      manager,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VENUE_CONFLICT');
  });

  it('a non-manager staff role cannot create an event', () => {
    const result = useStore.getState().dispatch(
      'event.create',
      {
        title: 'Unauthorized',
        venue: 'screening',
        type: 'movie',
        poster: '',
        description: '',
        ageRating: 'PG',
        durationMins: 60,
        pricing: { resident: 0, household: 0, guest_adult: 0, guest_child: 0 },
        showtimes: [
          {
            start: SHOWTIME_START,
            end: SHOWTIME_END,
            regOpens: NOW,
            regCloses: SHOWTIME_START,
            capacity: 10,
            capacityMode: 'headcount',
          },
        ],
      },
      { kind: 'staff', id: STAFF_IDS.agentDina, role: 'call_centre' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_PERMISSION');
  });

  it('cancelling an event cancels its showtimes, refunds confirmed RSVPs, and notifies', () => {
    const { event, showtimeId } = createScreeningEvent();
    useStore.getState().dispatch('event.publish', { eventId: event.id }, manager);

    const before = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0;
    const booked = useStore.getState().dispatch(
      'rsvp.bookNow',
      {
        showtimeId,
        attendees: [
          { category: 'resident', name: 'Layla', seat: 'A1' },
          { category: 'guest_adult', name: 'Guest', seat: 'A2' },
        ],
      },
      resident('layla'),
    );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));
    const afterCharge = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0;
    expect(before - afterCharge).toBe(2500);

    const cancelled = useStore
      .getState()
      .dispatch('event.cancel', { eventId: event.id, reason: 'Venue unavailable' }, manager);
    expect(cancelled.ok).toBe(true);
    expect(useStore.getState().showtimes[showtimeId]?.state).toBe('cancelled');
    expect(useStore.getState().rsvps[booked.value.id]?.state).toBe('cancelled');

    const afterRefund = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0;
    expect(afterRefund).toBe(before);
  });
});

describe('RSVP commands — hold / confirm / cancel', () => {
  beforeEach(() => resetStore());

  it('holds then confirms, charging the guest fee and scheduling two reminder jobs', () => {
    const { event, showtimeId } = createScreeningEvent();
    useStore.getState().dispatch('event.publish', { eventId: event.id }, manager);

    const held = useStore
      .getState()
      .dispatch(
        'rsvp.hold',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'A1' }] },
        resident('layla'),
      );
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(held.value.state).toBe('held');
    expect(useStore.getState().jobs[`rsvp-hold-expire:${held.value.id}`]).toBeDefined();

    const confirmed = useStore
      .getState()
      .dispatch('rsvp.confirm', { rsvpId: held.value.id }, resident('layla'));
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.state).toBe('confirmed');

    expect(useStore.getState().jobs[`event-reminder:${held.value.id}:T-24h`]).toBeDefined();
    expect(useStore.getState().jobs[`event-reminder:${held.value.id}:T-2h`]).toBeDefined();
  });

  it('the seat race: the first hold wins, the second gets SHOWTIME_HELD on the same seat', () => {
    const { showtimeId } = createScreeningEvent();

    const first = useStore
      .getState()
      .dispatch(
        'rsvp.hold',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'B3' }] },
        resident('layla'),
      );
    expect(first.ok).toBe(true);

    const second = useStore
      .getState()
      .dispatch(
        'rsvp.hold',
        { showtimeId, attendees: [{ category: 'resident', name: 'Sofia', seat: 'B3' }] },
        resident('sofia'),
      );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('SHOWTIME_HELD');
  });

  it('rejects more than the venue guest limit', () => {
    const { showtimeId } = createScreeningEvent();
    const result = useStore.getState().dispatch(
      'rsvp.bookNow',
      {
        showtimeId,
        attendees: [
          { category: 'resident', name: 'Sofia', seat: 'C1' },
          { category: 'guest_adult', name: 'G1', seat: 'C2' },
          { category: 'guest_adult', name: 'G2', seat: 'C3' },
          { category: 'guest_adult', name: 'G3', seat: 'C4' },
        ],
      },
      resident('sofia'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('GUEST_LIMIT');
  });

  it('on-time full cancellation refunds the guest fee and frees seats for the waitlist', () => {
    const { event, showtimeId } = createScreeningEvent({ capacity: 1 });
    useStore.getState().dispatch('event.publish', { eventId: event.id }, manager);

    const booked = useStore
      .getState()
      .dispatch(
        'rsvp.bookNow',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'A1' }] },
        resident('layla'),
      );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));

    const joined = useStore
      .getState()
      .dispatch('eventWaitlist.join', { showtimeId, partySize: 1 }, resident('sofia'));
    expect(joined.ok).toBe(true);

    const cancelled = useStore
      .getState()
      .dispatch('rsvp.cancel', { rsvpId: booked.value.id }, resident('layla'));
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.state).toBe('cancelled');

    if (!joined.ok) return;
    const entry = useStore.getState().waitlist[joined.value.id];
    expect(entry?.state).toBe('offered');
    expect(
      useStore.getState().jobs[`ewl-offer-expire:${joined.value.id}:${entry?.offer?.expiresAt}`],
    ).toBeDefined();
  });

  it('a late cancellation keeps the fee (no refund)', () => {
    const { event, showtimeId } = createScreeningEvent();
    useStore.getState().dispatch('event.publish', { eventId: event.id }, manager);

    const booked = useStore.getState().dispatch(
      'rsvp.bookNow',
      {
        showtimeId,
        attendees: [
          { category: 'resident', name: 'Layla', seat: 'A1' },
          { category: 'guest_adult', name: 'Guest', seat: 'A2' },
        ],
      },
      resident('layla'),
    );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));
    const balanceAfterCharge = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0;

    // Jump the clock to inside the free-cancellation window (screening: 2h before start).
    useStore.setState((s) => {
      s.demo.clock.now = addHoursIso(SHOWTIME_START, -1);
    });

    const cancelled = useStore
      .getState()
      .dispatch('rsvp.cancel', { rsvpId: booked.value.id }, resident('layla'));
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.state).toBe('late_cancelled');
    expect(useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0).toBe(balanceAfterCharge);
  });

  it('a partial cancellation refunds only the removed attendees and keeps the RSVP confirmed', () => {
    const { showtimeId } = createScreeningEvent();
    const booked = useStore.getState().dispatch(
      'rsvp.bookNow',
      {
        showtimeId,
        attendees: [
          { category: 'resident', name: 'Layla', seat: 'A1' },
          { category: 'guest_adult', name: 'Guest', seat: 'A2' },
        ],
      },
      resident('layla'),
    );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));
    const before = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0;
    const guestAttendeeId = booked.value.attendees.find((a) => a.category === 'guest_adult')!.id;

    const partial = useStore
      .getState()
      .dispatch(
        'rsvp.cancel',
        { rsvpId: booked.value.id, attendeeIds: [guestAttendeeId] },
        resident('layla'),
      );
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.value.state).toBe('confirmed');
    expect(partial.value.attendees).toHaveLength(1);
    expect((useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0) - before).toBe(2500);
  });

  it('marks attendance per-attendee', () => {
    const { showtimeId } = createScreeningEvent();
    const booked = useStore.getState().dispatch(
      'rsvp.bookNow',
      {
        showtimeId,
        attendees: [
          { category: 'resident', name: 'Layla', seat: 'A1' },
          { category: 'guest_adult', name: 'Guest', seat: 'A2' },
        ],
      },
      resident('layla'),
    );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));
    const [attendeeA, attendeeB] = booked.value.attendees;

    const marked = useStore
      .getState()
      .dispatch(
        'rsvp.markAttendance',
        {
          rsvpId: booked.value.id,
          attended: [attendeeA!.id],
          noShow: [attendeeB!.id],
          mode: 'live',
        },
        { kind: 'staff', id: STAFF_IDS.guardImran, role: 'guard' },
      );
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    const [a, b] = marked.value.attendees;
    expect(a?.attendance).toBe('attended');
    expect(b?.attendance).toBe('no_show');
  });
});

describe('event waitlist — party-size fitting and offer expiry', () => {
  beforeEach(() => resetStore());

  it('skips a party too big to fit and offers to the next one that fits', () => {
    const { showtimeId } = createScreeningEvent({ capacity: 2 });
    // Fill both seats with two separate single-seat bookings.
    const laylaBooked = useStore
      .getState()
      .dispatch(
        'rsvp.bookNow',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'A1' }] },
        resident('layla'),
      );
    const jamesBooked = useStore
      .getState()
      .dispatch(
        'rsvp.bookNow',
        { showtimeId, attendees: [{ category: 'resident', name: 'James', seat: 'A2' }] },
        resident('james'),
      );
    if (!laylaBooked.ok) throw new Error(JSON.stringify(laylaBooked.error));
    if (!jamesBooked.ok) throw new Error(JSON.stringify(jamesBooked.error));

    const bigParty = useStore
      .getState()
      .dispatch('eventWaitlist.join', { showtimeId, partySize: 2 }, resident('ahmed'));
    const fittingParty = useStore
      .getState()
      .dispatch('eventWaitlist.join', { showtimeId, partySize: 1 }, resident('sofia'));
    expect(bigParty.ok && fittingParty.ok).toBe(true);
    if (!bigParty.ok || !fittingParty.ok) return;

    // Free exactly 1 of the 2 occupied seats — the other booking keeps 1 seat taken.
    const freed = useStore
      .getState()
      .dispatch('rsvp.cancel', { rsvpId: jamesBooked.value.id }, resident('james'));
    expect(freed.ok).toBe(true);

    expect(useStore.getState().waitlist[bigParty.value.id]?.state).toBe('waiting');
    expect(useStore.getState().waitlist[fittingParty.value.id]?.state).toBe('offered');
  });

  it('accepting an offer auto-assigns seats and confirms a new RSVP', () => {
    const { showtimeId } = createScreeningEvent({ capacity: 1 });
    const booked = useStore
      .getState()
      .dispatch(
        'rsvp.bookNow',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'A1' }] },
        resident('layla'),
      );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));
    const joined = useStore
      .getState()
      .dispatch('eventWaitlist.join', { showtimeId, partySize: 1 }, resident('sofia'));
    if (!joined.ok) throw new Error(JSON.stringify(joined.error));
    useStore.getState().dispatch('rsvp.cancel', { rsvpId: booked.value.id }, resident('layla'));
    expect(useStore.getState().waitlist[joined.value.id]?.state).toBe('offered');

    const accepted = useStore
      .getState()
      .dispatch('eventWaitlist.accept', { waitlistEntryId: joined.value.id }, resident('sofia'));
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.value.state).toBe('confirmed');
    expect(accepted.value.attendees[0]?.seat).toBeDefined();
    expect(useStore.getState().waitlist[joined.value.id]?.state).toBe('accepted');
  });

  it('an expired offer rolls over to the scheduler and re-offers to the next waiting party', () => {
    const { showtimeId } = createScreeningEvent({ capacity: 1 });
    const booked = useStore
      .getState()
      .dispatch(
        'rsvp.bookNow',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'A1' }] },
        resident('layla'),
      );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));
    const first = useStore
      .getState()
      .dispatch('eventWaitlist.join', { showtimeId, partySize: 1 }, resident('sofia'));
    const second = useStore
      .getState()
      .dispatch('eventWaitlist.join', { showtimeId, partySize: 1 }, resident('priya'));
    if (!first.ok || !second.ok) throw new Error('join failed');
    useStore.getState().dispatch('rsvp.cancel', { rsvpId: booked.value.id }, resident('layla'));
    expect(useStore.getState().waitlist[first.value.id]?.state).toBe('offered');

    const offerExpiresAt = useStore.getState().waitlist[first.value.id]?.offer?.expiresAt;
    expect(offerExpiresAt).toBeDefined();

    useStore.setState((s) => {
      s.demo.clock.now = offerExpiresAt!;
    });
    schedulerEngine.runDue(offerExpiresAt!);

    expect(useStore.getState().waitlist[first.value.id]?.state).toBe('expired');
    expect(useStore.getState().waitlist[second.value.id]?.state).toBe('offered');
  });
});

describe('reminder job firing', () => {
  beforeEach(() => resetStore());

  it('firing the T-2h reminder job writes a WhatsApp template message with a Cancel button', () => {
    const { showtimeId } = createScreeningEvent();
    const booked = useStore
      .getState()
      .dispatch(
        'rsvp.bookNow',
        { showtimeId, attendees: [{ category: 'resident', name: 'Layla', seat: 'A1' }] },
        resident('layla'),
      );
    if (!booked.ok) throw new Error(JSON.stringify(booked.error));

    const reminderJob = useStore.getState().jobs[`event-reminder:${booked.value.id}:T-2h`];
    expect(reminderJob).toBeDefined();

    useStore.setState((s) => {
      s.demo.clock.now = reminderJob!.runAt;
    });
    schedulerEngine.runDue(reminderJob!.runAt);

    const messages = Object.values(useStore.getState().waMessages).filter(
      (m) => m.threadResidentId === PERSONA_IDS.layla,
    );
    const reminder = messages.find((m) => m.buttons?.some((b) => b.label === 'Cancel'));
    expect(reminder).toBeDefined();
    expect(reminder?.kind).toBe('template');
    expect(reminder?.buttons?.[0]?.action).toEqual({
      name: 'rsvp.cancel',
      args: { rsvpId: booked.value.id },
    });
  });
});
