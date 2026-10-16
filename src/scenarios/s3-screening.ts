/**
 * S3 — Screening Room: Family Movie Night (PRD §15, C1/C2).
 *
 * Step 1's "send the announcement to families with children in the same
 * flow" is the one PRD line this scenario doesn't script — the
 * announcement composer lands in P5, so `event.publish` only publishes
 * the event itself (documented on the command too).
 */
import { useStore } from '@/store';
import { PERSONA_IDS } from '@/seed/personaIds';
import { rules } from '@/config/rules';
import { addHoursIso, addMinutesIso } from '@/lib/time';
import type { Scenario } from './types';
import type { AppState } from '@/store/types';

const MANAGER = { kind: 'staff' as const, id: 'staff_hana', role: 'community_manager' };
const GUARD = { kind: 'staff' as const, id: 'staff_imran', role: 'guard' };
const LAYLA = { kind: 'resident' as const, id: PERSONA_IDS.layla };
const SOFIA = { kind: 'resident' as const, id: PERSONA_IDS.sofia };

const START = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai
const DAY1_EVENING = '2026-10-16T15:00:00.000Z'; // Fri 16 Oct, 19:00 Dubai
const DAY1_AFTERNOON = '2026-10-16T12:00:00.000Z'; // Fri 16 Oct, 16:00 Dubai
const DAY2_EVENING = '2026-10-17T15:00:00.000Z'; // Sat 17 Oct, 19:00 Dubai
const DAY2_AFTERNOON = '2026-10-17T12:00:00.000Z'; // Sat 17 Oct, 16:00 Dubai

function showtimeInput(start: string) {
  return {
    start,
    end: addHoursIso(start, 2),
    regOpens: START,
    regCloses: addMinutesIso(start, -rules.screening.registrationClosesMinutesBefore),
    capacity: rules.screening.capacity,
    capacityMode: 'seats' as const,
  };
}

export const s3Screening: Scenario = {
  id: 'S3',
  title: 'Screening Room: Family Movie Night',
  capability: ['C1', 'C2'],
  startAt: START,

  steps: [
    {
      title: 'Console creates and publishes the event',
      body: '2 days × 2 showtimes, rated PG, guest pricing (AED 25 adult / AED 15 child). Publish.',
      setup: {
        devices: {
          A: { role: 'console', actorId: 'staff_hana', consoleRole: 'community_manager' },
        },
      },
      script: [
        {
          command: 'event.create',
          input: {
            title: 'Family Movie Night',
            venue: 'screening',
            type: 'movie',
            poster: '/amenities/screening.jpg',
            description: 'A family-friendly double feature in the Screening Room.',
            ageRating: 'PG',
            durationMins: 120,
            pricing: rules.screening.pricing,
            showtimes: [
              showtimeInput(DAY1_AFTERNOON),
              showtimeInput(DAY1_EVENING),
              showtimeInput(DAY2_AFTERNOON),
              showtimeInput(DAY2_EVENING),
            ],
          },
          actor: MANAGER,
        },
      ],
      expect: (s) => {
        const event = Object.values(s.events).find((e) => e.title === 'Family Movie Night');
        if (!event) throw new Error('Expected the Family Movie Night event to exist');
        if (event.lifecycle !== 'draft')
          throw new Error('Expected a fresh event to start as draft');
        const showtimes = Object.values(s.showtimes).filter((sh) => sh.eventId === event.id);
        if (showtimes.length !== 4) throw new Error('Expected 4 showtimes across 2 days');
      },
    },
    {
      title: 'Console publishes',
      setup: {
        devices: {
          A: { role: 'console', actorId: 'staff_hana', consoleRole: 'community_manager' },
        },
      },
      body: 'Publish the event so residents can see and RSVP.',
      script: [
        {
          command: 'event.publish',
          input: (s: AppState) => {
            const event = Object.values(s.events).find((e) => e.title === 'Family Movie Night');
            return { eventId: event?.id };
          },
          actor: MANAGER,
        },
      ],
      expect: (s) => {
        const event = Object.values(s.events).find((e) => e.title === 'Family Movie Night');
        if (event?.lifecycle !== 'published') throw new Error('Expected the event to be published');
      },
    },
    {
      title: 'Layla RSVPs: 2 residents, 2 kids, 1 guest adult',
      body: "What's On → year view → this week → the event. RSVP 2 residents + 2 kids (household, free) + 1 guest adult. Choose seats — AED 25 is charged.",
      setup: { devices: { A: { role: 'resident', actorId: PERSONA_IDS.layla } } },
      script: [
        {
          command: 'rsvp.bookNow',
          input: (s: AppState) => {
            const showtime = Object.values(s.showtimes).find((sh) => sh.start === DAY1_EVENING);
            return {
              showtimeId: showtime?.id,
              attendees: [
                { category: 'resident', name: 'Layla', seat: 'A1' },
                { category: 'household', name: "Layla's spouse", seat: 'A2' },
                { category: 'household', name: 'Omar', seat: 'A3' },
                { category: 'household', name: 'Noor', seat: 'A4' },
                { category: 'guest_adult', name: 'Guest of Layla', seat: 'A5' },
              ],
            };
          },
          actor: LAYLA,
        },
      ],
      expect: (s) => {
        const rsvp = Object.values(s.rsvps).find((r) => r.bookerId === PERSONA_IDS.layla);
        if (!rsvp || rsvp.state !== 'confirmed')
          throw new Error("Expected Layla's RSVP to be confirmed");
        if (rsvp.attendees.length !== 5) throw new Error('Expected 5 attendees');
        const feeFils = rsvp.charges.reduce((sum, c) => sum + c.fils, 0);
        if (feeFils !== 2500)
          throw new Error(`Expected AED 25 (2500 fils) charged, got ${feeFils}`);
      },
    },
    {
      title: 'Sofia is blocked — 3 guests exceeds the guest limit',
      body: 'Sofia tries to RSVP with 3 guests. Blocked by the guest limit (max 2 per unit per showtime).',
      setup: { devices: { A: { role: 'resident', actorId: PERSONA_IDS.sofia } } },
      expect: (s) => {
        const showtime = Object.values(s.showtimes).find((sh) => sh.start === DAY1_EVENING);
        if (!showtime) throw new Error('Showtime not found');
        const result = useStore.getState().dispatch(
          'rsvp.bookNow',
          {
            showtimeId: showtime.id,
            attendees: [
              { category: 'resident', name: 'Sofia' },
              { category: 'guest_adult', name: 'Guest 1' },
              { category: 'guest_adult', name: 'Guest 2' },
              { category: 'guest_adult', name: 'Guest 3' },
            ],
          },
          SOFIA,
        );
        if (result.ok) throw new Error('Expected Sofia’s 3-guest RSVP to be rejected');
        if (result.error.code !== 'GUEST_LIMIT')
          throw new Error(`Expected GUEST_LIMIT, got ${result.error.code}`);
        if (Object.values(s.rsvps).some((r) => r.bookerId === PERSONA_IDS.sofia))
          throw new Error('Expected no RSVP to have been created for Sofia');
      },
    },
    {
      title: 'T-2h: a WhatsApp reminder with a Cancel quick reply',
      body: 'Skip the clock to T-2h before the showtime. A WhatsApp reminder arrives with a "Cancel" quick reply.',
      setup: {
        clock: addHoursIso(DAY1_EVENING, -2),
        devices: { A: { role: 'whatsapp', actorId: PERSONA_IDS.layla } },
      },
      expect: (s) => {
        const messages = Object.values(s.waMessages).filter(
          (m) => m.threadResidentId === PERSONA_IDS.layla,
        );
        const reminder = messages.find((m) => m.buttons?.some((b) => b.label === 'Cancel'));
        if (!reminder) throw new Error('Expected a WhatsApp reminder with a Cancel quick reply');
      },
    },
    {
      title: 'Guard marks 4 of 5 attended, post-remote',
      body: "Skip past the showtime end. Attendance → mark 4 of 5 attended (post-remote). The breakdown is visible in the resident's RSVP and the console's attendance data.",
      setup: {
        clock: addHoursIso(DAY1_EVENING, 3),
        devices: { A: { role: 'guard', actorId: 'staff_imran' } },
      },
      script: [
        {
          command: 'rsvp.markAttendance',
          input: (s: AppState) => {
            const rsvp = Object.values(s.rsvps).find((r) => r.bookerId === PERSONA_IDS.layla);
            const [a, b, c, d, e] = rsvp?.attendees ?? [];
            return {
              rsvpId: rsvp?.id,
              attended: [a?.id, b?.id, c?.id, d?.id].filter(Boolean),
              noShow: [e?.id].filter(Boolean),
              mode: 'post',
            };
          },
          actor: GUARD,
        },
      ],
      expect: (s) => {
        const rsvp = Object.values(s.rsvps).find((r) => r.bookerId === PERSONA_IDS.layla);
        const attended = rsvp?.attendees.filter((a) => a.attendance === 'attended').length ?? 0;
        const noShow = rsvp?.attendees.filter((a) => a.attendance === 'no_show').length ?? 0;
        if (attended !== 4 || noShow !== 1)
          throw new Error(`Expected 4 attended / 1 no-show, got ${attended}/${noShow}`);
      },
    },
  ],
};
