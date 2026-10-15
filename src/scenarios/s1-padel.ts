/**
 * S1 — Padel: fair booking, a waitlist and a no-show (PRD §15, C1).
 */
import { PERSONA_IDS, UNIT_IDS } from '@/seed/personaIds';
import type { Scenario } from './types';
import type { AppState } from '@/store/types';

const JAMES = { kind: 'resident' as const, id: PERSONA_IDS.james };
const LAYLA = { kind: 'resident' as const, id: PERSONA_IDS.layla };
const AHMED = { kind: 'resident' as const, id: PERSONA_IDS.ahmed };

// Thu 15 Oct, 17:00 Dubai (90 min) — the slot the whole scenario revolves around.
const THU_1700 = '2026-10-15T13:00:00.000Z';

export const s1Padel: Scenario = {
  id: 'S1',
  title: 'Padel: fair booking, a waitlist and a no-show',
  capability: ['C1'],
  startAt: '2026-10-14T13:30:00.000Z', // Wed 14 Oct, 17:30 Dubai

  fixtures: (draft) => {
    const now = '2026-10-14T13:30:00.000Z';
    draft.wallets[UNIT_IDS.james] = { unitId: UNIT_IDS.james, balanceFils: 100000 };
    // "James's 2 bookings this week are both peak (Mon 19:00, Tue 20:00)."
    const peakBooking = (id: string, start: string, end: string) => {
      draft.bookings[id] = {
        id,
        createdAt: now,
        updatedAt: now,
        amenity: 'padel',
        unitId: UNIT_IDS.james,
        bookerId: PERSONA_IDS.james,
        start,
        end,
        players: [],
        charges: [],
        state: 'confirmed',
        history: [{ state: 'confirmed', at: now, by: PERSONA_IDS.james }],
        source: 'resident',
        countsTowardQuota: true,
      };
    };
    peakBooking('bk_s1_mon', '2026-10-12T15:00:00.000Z', '2026-10-12T16:00:00.000Z'); // Mon 19:00 Dubai
    peakBooking('bk_s1_tue', '2026-10-13T16:00:00.000Z', '2026-10-13T17:00:00.000Z'); // Tue 20:00 Dubai

    // Two prior strikes already on file this penalty window, so the late cancel in step 4 is his 3rd.
    for (const [sid, at] of [
      ['strike_s1_1', '2026-09-20T10:00:00.000Z'],
      ['strike_s1_2', '2026-09-28T10:00:00.000Z'],
    ] as const) {
      draft.strikes[sid] = {
        id: sid,
        createdAt: at,
        updatedAt: at,
        residentId: PERSONA_IDS.james,
        unitId: UNIT_IDS.james,
        amenity: 'padel',
        kind: 'no_show',
        at,
        bookingId: 'bk_s1_history',
      };
    }
  },

  steps: [
    {
      title: 'James books Thursday 17:00',
      body: 'Padel quota shows 2 of 3 used (both peak). Thu 21:00 is blocked by the peak sub-limit. Book Thu 17:00 for 90 min with 1 guest (AED 50).',
      setup: { devices: { A: { role: 'resident', actorId: PERSONA_IDS.james } } },
      script: [
        {
          command: 'booking.bookNow',
          input: {
            start: THU_1700,
            durationMinutes: 90,
            players: [{ guestName: 'Guest of James', guestPhone: '+971500000001' }],
          },
          actor: JAMES,
        },
      ],
      expect: (s) => {
        const booking = Object.values(s.bookings).find(
          (b) => b.bookerId === PERSONA_IDS.james && b.start === THU_1700,
        );
        if (!booking || booking.state !== 'confirmed')
          throw new Error('James’s Thu 17:00 booking was not confirmed');
        if (booking.charges.reduce((sum, c) => sum + c.fils, 0) !== 5000)
          throw new Error('Guest fee not charged');
      },
    },
    {
      title: 'Layla joins the waitlist',
      body: 'Thu 17:00 shows "Booked". Layla joins the waitlist as #1.',
      setup: { devices: { A: { role: 'resident', actorId: PERSONA_IDS.layla } } },
      script: [{ command: 'waitlist.join', input: { start: THU_1700 }, actor: LAYLA }],
      expect: (s) => {
        const entry = Object.values(s.waitlist).find((w) => w.residentId === PERSONA_IDS.layla);
        if (!entry || entry.state !== 'waiting') throw new Error('Layla is not waiting');
      },
    },
    {
      title: 'Ahmed joins the waitlist',
      body: 'Dual view: Ahmed joins the same waitlist as #2.',
      setup: {
        dualView: true,
        devices: {
          A: { role: 'resident', actorId: PERSONA_IDS.layla },
          B: { role: 'resident', actorId: PERSONA_IDS.ahmed },
        },
      },
      script: [{ command: 'waitlist.join', input: { start: THU_1700 }, actor: AHMED }],
      expect: (s) => {
        const layla = Object.values(s.waitlist).find((w) => w.residentId === PERSONA_IDS.layla);
        const ahmed = Object.values(s.waitlist).find((w) => w.residentId === PERSONA_IDS.ahmed);
        if (!layla || !ahmed || ahmed.position <= layla.position)
          throw new Error('Ahmed is not behind Layla');
      },
    },
    {
      title: 'James late-cancels — strike 3 of 3',
      body: 'Move the clock to Thu 13:00 (inside the 6h cutoff) and cancel: strike 3 of 3, a suspension banner appears, and the guest fee is not refunded.',
      setup: {
        clock: '2026-10-15T09:00:00.000Z',
        devices: { A: { role: 'resident', actorId: PERSONA_IDS.james } },
      },
      script: [
        {
          command: 'booking.cancel',
          input: (s: AppState) => {
            const booking = Object.values(s.bookings).find(
              (b) => b.bookerId === PERSONA_IDS.james && b.start === THU_1700,
            );
            return { bookingId: booking?.id };
          },
          actor: JAMES,
        },
      ],
      expect: (s) => {
        const booking = Object.values(s.bookings).find(
          (b) => b.bookerId === PERSONA_IDS.james && b.start === THU_1700,
        );
        if (booking?.state !== 'late_cancelled') throw new Error('Expected a late cancellation');
        if (booking.charges.length === 0)
          throw new Error('The guest fee should still show as charged (not refunded)');
        const suspension = Object.values(s.suspensions).find(
          (sp) => sp.residentId === PERSONA_IDS.james && sp.amenity === 'padel' && !sp.liftedBy,
        );
        if (!suspension) throw new Error('Expected James to be suspended at strike 3');
        const laylaOffer = Object.values(s.waitlist).find(
          (w) => w.residentId === PERSONA_IDS.layla,
        );
        if (laylaOffer?.state !== 'offered')
          throw new Error('Expected Layla to be offered the freed slot');
      },
    },
    {
      title: "Layla's offer expires — it passes to Ahmed",
      body: 'The waitlist offer arrives in both app and WhatsApp with a 15-minute hold. Layla lets it expire: skip the clock forward 15 min.',
      setup: {
        clock: '2026-10-15T09:15:00.000Z',
        devices: { A: { role: 'whatsapp', actorId: PERSONA_IDS.layla } },
      },
      expect: (s) => {
        const layla = Object.values(s.waitlist).find((w) => w.residentId === PERSONA_IDS.layla);
        const ahmed = Object.values(s.waitlist).find((w) => w.residentId === PERSONA_IDS.ahmed);
        if (layla?.state !== 'expired') throw new Error("Expected Layla's offer to have expired");
        if (ahmed?.state !== 'offered') throw new Error('Expected the offer to pass to Ahmed');
      },
    },
    {
      title: 'Ahmed accepts on WhatsApp',
      body: 'Reply "1" and the booking is confirmed; the app updates live.',
      setup: { devices: { A: { role: 'whatsapp', actorId: PERSONA_IDS.ahmed } } },
      script: [
        {
          command: 'waitlist.accept',
          input: (s: AppState) => {
            const entry = Object.values(s.waitlist).find((w) => w.residentId === PERSONA_IDS.ahmed);
            return { waitlistEntryId: entry?.id };
          },
          actor: AHMED,
        },
      ],
      expect: (s) => {
        const booking = Object.values(s.bookings).find(
          (b) => b.bookerId === PERSONA_IDS.ahmed && b.start === THU_1700,
        );
        if (booking?.state !== 'confirmed')
          throw new Error("Expected Ahmed's booking to be confirmed");
      },
    },
    {
      title: 'Alternative ending — Ahmed no-shows',
      body: 'Skip to Thu 17:16 without checking Ahmed in. The no-show sweep flags him, records a strike, and releases the rest of the slot.',
      setup: {
        clock: '2026-10-15T13:16:00.000Z',
        devices: { A: { role: 'guard', actorId: 'staff_imran' } },
      },
      expect: (s) => {
        const booking = Object.values(s.bookings).find(
          (b) => b.bookerId === PERSONA_IDS.ahmed && b.start === THU_1700,
        );
        if (booking?.state !== 'no_show')
          throw new Error("Expected Ahmed's booking to be marked a no-show");
        const strike = Object.values(s.strikes).find((st) => st.bookingId === booking.id);
        if (!strike) throw new Error('Expected a strike for the no-show');
      },
    },
  ],
};
