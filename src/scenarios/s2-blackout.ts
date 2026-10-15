/**
 * S2 — Padel blackout for maintenance (PRD §15, C1/C3/C5). Self-contained
 * (not literally chained to S1's own run — its fixtures recreate the "Thu
 * 17:00, Ahmed confirmed" state S1's non-alternative ending would leave),
 * so it can run headless on its own from a fresh seed.
 */
import { PERSONA_IDS, UNIT_IDS } from '@/seed/personaIds';
import type { Scenario } from './types';

const SUPERVISOR = { kind: 'staff' as const, id: 'staff_victor', role: 'community_manager' };
const AHMED = { kind: 'resident' as const, id: PERSONA_IDS.ahmed };

const THU_1700 = '2026-10-15T13:00:00.000Z'; // Ahmed's existing booking, inside the blackout window
const BLACKOUT_START = '2026-10-15T02:00:00.000Z'; // Thu 06:00 Dubai
const BLACKOUT_END = '2026-10-16T08:00:00.000Z'; // Fri 12:00 Dubai
const REBOOK_START = '2026-10-16T13:00:00.000Z'; // Fri 17:00 Dubai — after the blackout ends

export const s2Blackout: Scenario = {
  id: 'S2',
  title: 'Padel blackout for maintenance',
  capability: ['C1', 'C3', 'C5'],
  startAt: '2026-10-14T13:30:00.000Z',

  fixtures: (draft) => {
    const now = '2026-10-14T13:30:00.000Z';
    draft.bookings['bk_s2_ahmed'] = {
      id: 'bk_s2_ahmed',
      createdAt: now,
      updatedAt: now,
      amenity: 'padel',
      unitId: UNIT_IDS.ahmed,
      bookerId: PERSONA_IDS.ahmed,
      start: THU_1700,
      end: '2026-10-15T14:00:00.000Z',
      players: [],
      charges: [],
      state: 'confirmed',
      history: [{ state: 'confirmed', at: now, by: PERSONA_IDS.ahmed }],
      source: 'resident',
      countsTowardQuota: true,
    };
  },

  steps: [
    {
      title: 'Supervisor creates a blackout',
      body: 'Padel → Blackout, Thu 06:00 – Fri 12:00, linked to WO-0219 (CourtPro). Impact preview: 1 booking · 1 resident. Choose "Cancel + priority rebook" and confirm.',
      setup: {
        devices: {
          A: { role: 'console', actorId: 'staff_victor', consoleRole: 'community_manager' },
        },
      },
      script: [
        {
          command: 'blackout.create',
          input: {
            start: BLACKOUT_START,
            end: BLACKOUT_END,
            reason: 'Surface resurfacing — CourtPro Sports',
            handling: 'cancel_priority_rebook',
            workOrderId: 'WO-0219',
          },
          actor: SUPERVISOR,
        },
      ],
      expect: (s) => {
        const blackout = Object.values(s.blackouts).find((b) => b.workOrderId === 'WO-0219');
        if (!blackout) throw new Error('Expected a blackout to have been created');
        const booking = s.bookings['bk_s2_ahmed'];
        if (booking?.state !== 'cancelled_by_ops')
          throw new Error("Expected Ahmed's booking to be cancelled by ops");
        const notif = Object.values(s.notifications).find(
          (n) => n.recipientId === PERSONA_IDS.ahmed,
        );
        if (!notif) throw new Error('Expected Ahmed to be notified');
      },
    },
    {
      title: 'Ahmed picks a priority rebook slot',
      body: "Ahmed's Thu 17:00 booking was cancelled by ops. He gets a notification, an amenity banner, and a priority-rebook sheet with 3 slots. He picks one — it doesn't use his weekly quota.",
      setup: { devices: { A: { role: 'resident', actorId: PERSONA_IDS.ahmed } } },
      script: [
        {
          command: 'booking.priorityRebook',
          input: { originalBookingId: 'bk_s2_ahmed', start: REBOOK_START, durationMinutes: 60 },
          actor: AHMED,
        },
      ],
      expect: (s) => {
        const rebooked = Object.values(s.bookings).find(
          (b) => b.bookerId === PERSONA_IDS.ahmed && b.start === REBOOK_START,
        );
        if (rebooked?.state !== 'confirmed')
          throw new Error('Expected the priority rebook to be confirmed');
        if (rebooked.countsTowardQuota)
          throw new Error("A priority rebook shouldn't count toward quota");
      },
    },
  ],
};
