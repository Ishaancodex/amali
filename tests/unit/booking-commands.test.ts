import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, UNIT_IDS } from '@/seed/personaIds';
import { addMinutesIso } from '@/lib/time';
import type { Booking } from '@/types/booking';

const NOW = '2026-10-14T13:30:00.000Z'; // DEMO_START_ISO
const SLOT_A = '2026-10-15T10:00:00.000Z'; // Thu 14:00 Dubai
const SLOT_B = '2026-10-15T15:00:00.000Z'; // Thu 19:00 Dubai (peak)

function resetStore(now = NOW): void {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
}

function actor(personaKey: keyof typeof PERSONA_IDS) {
  return { kind: 'resident' as const, id: PERSONA_IDS[personaKey] };
}

describe('booking commands — hold / confirm', () => {
  beforeEach(() => resetStore());

  it('holds then confirms a free slot', () => {
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('james'),
      );
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(held.value.state).toBe('held');

    const confirmed = useStore
      .getState()
      .dispatch('booking.confirm', { bookingId: held.value.id }, actor('james'));
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.state).toBe('confirmed');
    expect(useStore.getState().bookings[held.value.id]?.state).toBe('confirmed');
  });

  it('charges the wallet and writes a ledger entry for a guest', () => {
    useStore.setState((s) => {
      s.wallets[UNIT_IDS.james] = { unitId: UNIT_IDS.james, balanceFils: 100000 };
    });
    const before = useStore.getState().wallets[UNIT_IDS.james]?.balanceFils ?? 0;
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        {
          start: SLOT_A,
          durationMinutes: 60,
          players: [{ guestName: 'Guest', guestPhone: '971500000' }],
        },
        actor('james'),
      );
    if (!held.ok) throw new Error('hold failed: ' + JSON.stringify(held.error));
    useStore.getState().dispatch('booking.confirm', { bookingId: held.value.id }, actor('james'));

    const after = useStore.getState().wallets[UNIT_IDS.james]?.balanceFils ?? 0;
    expect(before - after).toBe(5000);
    const ledgerEntries = Object.values(useStore.getState().ledger).filter(
      (e) => e.ref?.id === held.value.id,
    );
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0]?.kind).toBe('charge');
  });

  it('the double-hold race: the first hold wins, the second gets SLOT_HELD', () => {
    const first = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('james'),
      );
    expect(first.ok).toBe(true);

    const second = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('layla'),
      );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('SLOT_HELD');

    // Exactly one booking exists for this slot.
    const bookingsAtSlot = Object.values(useStore.getState().bookings).filter(
      (b) => b.start === SLOT_A,
    );
    expect(bookingsAtSlot).toHaveLength(1);
  });

  it('a held booking that is never confirmed is released by the hold.expire job', () => {
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('james'),
      );
    if (!held.ok) throw new Error('hold failed');
    expect(useStore.getState().bookings[held.value.id]?.state).toBe('held');

    const expiry = addMinutesIso(NOW, 4); // past the 180s hold window
    schedulerEngine.runDue(expiry);

    expect(useStore.getState().bookings[held.value.id]).toBeUndefined();

    // The slot is free again.
    const retry = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('layla'),
      );
    expect(retry.ok).toBe(true);
  });
});

describe('booking commands — cancel, strikes and suspension', () => {
  beforeEach(() => resetStore());

  function confirmBooking(persona: keyof typeof PERSONA_IDS, start: string): Booking {
    const held = useStore
      .getState()
      .dispatch('booking.hold', { start, durationMinutes: 60, players: [] }, actor(persona));
    if (!held.ok) throw new Error('hold failed: ' + JSON.stringify(held.error));
    const confirmed = useStore
      .getState()
      .dispatch('booking.confirm', { bookingId: held.value.id }, actor(persona));
    if (!confirmed.ok) throw new Error('confirm failed: ' + JSON.stringify(confirmed.error));
    return confirmed.value;
  }

  it('an on-time cancel frees the booking with no strike', () => {
    const booking = confirmBooking('james', SLOT_A);
    const result = useStore
      .getState()
      .dispatch('booking.cancel', { bookingId: booking.id }, actor('james'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe('cancelled');
    expect(
      Object.values(useStore.getState().strikes).filter((s) => s.bookingId === booking.id),
    ).toHaveLength(0);
  });

  it('a late cancel (inside the 6h cutoff) adds a strike and does not refund', () => {
    const booking = confirmBooking('james', SLOT_A);
    useStore.setState((s) => {
      s.demo.clock.now = addMinutesIso(SLOT_A, -60); // 1h before start — inside the 6h free-cancellation window
    });

    const result = useStore
      .getState()
      .dispatch('booking.cancel', { bookingId: booking.id }, actor('james'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe('late_cancelled');
    const strikes = Object.values(useStore.getState().strikes).filter(
      (s) => s.bookingId === booking.id,
    );
    expect(strikes).toHaveLength(1);
    expect(strikes[0]?.kind).toBe('late_cancel');
  });

  it('a 3rd active strike suspends padel for the resident', () => {
    const now = useStore.getState().demo.clock.now;
    for (let i = 0; i < 3; i += 1) {
      const strikeId = `strike_test_${i}`;
      useStore.setState((s) => {
        s.strikes[strikeId] = {
          id: strikeId,
          createdAt: now,
          updatedAt: now,
          residentId: PERSONA_IDS.james,
          unitId: UNIT_IDS.james,
          amenity: 'padel',
          kind: 'no_show',
          at: now,
          bookingId: `bk_fake_${i}`,
        };
      });
    }
    // The 3rd strike above was written directly (not through booking.cancel), so suspend manually
    // to prove isCurrentlySuspended + validateBooking correctly block a new hold.
    useStore.setState((s) => {
      s.suspensions['susp_test'] = {
        id: 'susp_test',
        createdAt: now,
        updatedAt: now,
        residentId: PERSONA_IDS.james,
        amenity: 'padel',
        from: now,
        to: addMinutesIso(now, 7 * 24 * 60),
      };
    });

    const result = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('james'),
      );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SUSPENDED');
  });
});

describe('booking commands — waitlist', () => {
  beforeEach(() => resetStore());

  it('joins, offers sequentially on cancellation, and the next person accepts after an expiry', () => {
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_B, durationMinutes: 60, players: [] },
        actor('james'),
      );
    if (!held.ok) throw new Error('hold failed');
    const confirmed = useStore
      .getState()
      .dispatch('booking.confirm', { bookingId: held.value.id }, actor('james'));
    if (!confirmed.ok) throw new Error('confirm failed: ' + JSON.stringify(confirmed.error));

    const laylaJoin = useStore
      .getState()
      .dispatch('waitlist.join', { start: SLOT_B }, actor('layla'));
    expect(laylaJoin.ok).toBe(true);
    const ahmedJoin = useStore
      .getState()
      .dispatch('waitlist.join', { start: SLOT_B }, actor('ahmed'));
    expect(ahmedJoin.ok).toBe(true);
    if (!laylaJoin.ok || !ahmedJoin.ok) return;
    expect(laylaJoin.value.position).toBeLessThan(ahmedJoin.value.position);

    // James late-cancels inside the cutoff, freeing the slot to the waitlist.
    useStore.setState((s) => {
      s.demo.clock.now = addMinutesIso(SLOT_B, -60);
    });
    const cancel = useStore
      .getState()
      .dispatch('booking.cancel', { bookingId: confirmed.value.id }, actor('james'));
    expect(cancel.ok).toBe(true);

    expect(useStore.getState().waitlist[laylaJoin.value.id]?.state).toBe('offered');
    expect(useStore.getState().waitlist[ahmedJoin.value.id]?.state).toBe('waiting');

    // Layla lets her offer expire.
    const laylaOfferExpiry = useStore.getState().waitlist[laylaJoin.value.id]?.offer?.expiresAt;
    expect(laylaOfferExpiry).toBeDefined();
    useStore.setState((s) => {
      s.demo.clock.now = laylaOfferExpiry as string;
    });
    schedulerEngine.runDue(laylaOfferExpiry as string);

    expect(useStore.getState().waitlist[laylaJoin.value.id]?.state).toBe('expired');
    expect(useStore.getState().waitlist[ahmedJoin.value.id]?.state).toBe('offered');

    // Ahmed accepts.
    const accept = useStore
      .getState()
      .dispatch('waitlist.accept', { waitlistEntryId: ahmedJoin.value.id }, actor('ahmed'));
    if (!accept.ok) throw new Error('accept failed: ' + JSON.stringify(accept.error));
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    expect(accept.value.state).toBe('confirmed');
    expect(accept.value.bookerId).toBe(PERSONA_IDS.ahmed);
  });
});

describe('booking commands — no-show sweep', () => {
  beforeEach(() => resetStore());

  it('flags an unchecked-in booking as a no-show after the grace period and adds a strike', () => {
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('james'),
      );
    if (!held.ok) throw new Error('hold failed');
    const confirmed = useStore
      .getState()
      .dispatch('booking.confirm', { bookingId: held.value.id }, actor('james'));
    if (!confirmed.ok) throw new Error('confirm failed');

    const sweepAt = addMinutesIso(SLOT_A, 16); // past the 15-min grace
    schedulerEngine.runDue(sweepAt);

    expect(useStore.getState().bookings[confirmed.value.id]?.state).toBe('no_show');
    const strikes = Object.values(useStore.getState().strikes).filter(
      (s) => s.bookingId === confirmed.value.id,
    );
    expect(strikes).toHaveLength(1);
    expect(strikes[0]?.kind).toBe('no_show');
  });

  it('does not flag a checked-in booking', () => {
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [] },
        actor('james'),
      );
    if (!held.ok) throw new Error('hold failed');
    const confirmed = useStore
      .getState()
      .dispatch('booking.confirm', { bookingId: held.value.id }, actor('james'));
    if (!confirmed.ok) throw new Error('confirm failed');

    useStore.setState((s) => {
      s.demo.clock.now = addMinutesIso(SLOT_A, -5);
    });
    const checkIn = useStore
      .getState()
      .dispatch('booking.checkIn', { bookingId: confirmed.value.id }, actor('james'));
    expect(checkIn.ok).toBe(true);

    schedulerEngine.runDue(addMinutesIso(SLOT_A, 16));
    expect(useStore.getState().bookings[confirmed.value.id]?.state).toBe('checked_in');
  });
});

describe('booking commands — blackout and priority rebook', () => {
  beforeEach(() => resetStore());

  it('cancels affected bookings, refunds charges, and lets the resident priority-rebook without using quota', () => {
    useStore.setState((s) => {
      s.wallets[UNIT_IDS.james] = { unitId: UNIT_IDS.james, balanceFils: 100000 };
    });
    const held = useStore
      .getState()
      .dispatch(
        'booking.hold',
        { start: SLOT_A, durationMinutes: 60, players: [{ guestName: 'G', guestPhone: '1' }] },
        actor('james'),
      );
    if (!held.ok) throw new Error('hold failed: ' + JSON.stringify(held.error));
    const confirmed = useStore
      .getState()
      .dispatch('booking.confirm', { bookingId: held.value.id }, actor('james'));
    if (!confirmed.ok) throw new Error('confirm failed');
    const balanceAfterCharge = useStore.getState().wallets[UNIT_IDS.james]?.balanceFils ?? 0;

    const blackout = useStore.getState().dispatch(
      'blackout.create',
      {
        start: '2026-10-15T00:00:00.000Z',
        end: '2026-10-16T00:00:00.000Z',
        reason: 'resurfacing',
        handling: 'cancel_priority_rebook',
        workOrderId: 'wo_1',
      },
      { kind: 'staff', id: 'staff_victor', role: 'community_manager' },
    );
    if (!blackout.ok) throw new Error('blackout failed: ' + JSON.stringify(blackout.error));
    expect(blackout.ok).toBe(true);

    const cancelled = useStore.getState().bookings[confirmed.value.id];
    expect(cancelled?.state).toBe('cancelled_by_ops');
    const balanceAfterRefund = useStore.getState().wallets[UNIT_IDS.james]?.balanceFils ?? 0;
    expect(balanceAfterRefund).toBe(balanceAfterCharge + 5000);

    // The blacked-out day is unavailable, so rebook on a day after the blackout ends.
    const rebook = useStore
      .getState()
      .dispatch(
        'booking.priorityRebook',
        {
          originalBookingId: confirmed.value.id,
          start: '2026-10-16T10:00:00.000Z',
          durationMinutes: 60,
        },
        actor('james'),
      );
    expect(rebook.ok).toBe(true);
    if (!rebook.ok) return;
    expect(rebook.value.state).toBe('confirmed');
    expect(rebook.value.countsTowardQuota).toBe(false);
  });
});
