/**
 * S4 — Creche: a supervised session with a ratio change (PRD §15, C1/C3/C5).
 */
import { CHILD_IDS, PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { arriveSeededMorning, sessionId } from '@/seed/creche';
import { selectBandLoads, selectBoardSession } from '@/store/selectors/creche';
import type { AppState } from '@/store/types';
import type { Scenario } from './types';

const DATE = '2026-10-14'; // Wed
const START = '2026-10-14T03:30:00.000Z'; // 07:30 Dubai — booking ahead of the 1h lead time
const CHECK_IN_AT = '2026-10-14T05:04:00.000Z'; // 09:04
const SICK_AT = '2026-10-14T05:40:00.000Z'; // 09:40
const INCIDENT_AT = '2026-10-14T06:30:00.000Z'; // 10:30
const PICKUP_AT = '2026-10-14T07:55:00.000Z'; // 11:55

const LAYLA = { kind: 'resident' as const, id: PERSONA_IDS.layla };
const MARIA = { kind: 'staff' as const, id: STAFF_IDS.crecheMaria, role: 'creche_lead' };
const HANA = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };
const MORNING = sessionId(DATE, 'morning');

function omarBooking(s: AppState) {
  const booking = Object.values(s.crecheBookings).find(
    (b) => b.childId === CHILD_IDS.omar && b.sessionId === MORNING,
  );
  if (!booking) throw new Error('Expected Omar booked for the morning session');
  return booking;
}

function kidsLoad(s: AppState) {
  const load = selectBandLoads(s, selectBoardSession(s, s.demo.clock.now)).find(
    (l) => l.band === 'kids',
  );
  if (!load) throw new Error('Expected a Kids band load');
  return load;
}

function graceShiftId(s: AppState): string {
  const shift = Object.values(s.shifts).find(
    (x) => x.staffId === STAFF_IDS.crecheGrace && x.date === DATE && x.amenity === 'creche',
  );
  if (!shift) throw new Error('Expected Grace on the creche roster today');
  return shift.id;
}

export const s4Creche: Scenario = {
  id: 'S4',
  title: 'Creche: a supervised session with a ratio change',
  capability: ['C1', 'C3', 'C5'],
  startAt: START,

  steps: [
    {
      title: 'Layla books Omar (4, Kids band) into the morning session',
      body: 'My Unit → Children → Omar → Book a session. The Kids band is staffed by Grace and Aisha (2 × 8 = 16) with 11 already booked, so Omar is confirmed.',
      setup: {
        devices: {
          A: {
            role: 'resident',
            actorId: PERSONA_IDS.layla,
            deepLink: `amali://resident/child-detail?id=${CHILD_IDS.omar}`,
          },
        },
      },
      script: [
        {
          command: 'creche.book',
          input: { childIds: [CHILD_IDS.omar], sessionId: MORNING },
          actor: LAYLA,
        },
      ],
      expect: (s) => {
        const booking = omarBooking(s);
        if (booking.state !== 'confirmed' || booking.band !== 'kids') {
          throw new Error(
            `Expected a confirmed Kids booking, got ${booking.state}/${booking.band}`,
          );
        }
      },
    },
    {
      title: 'Maria scans Layla’s pass — allergy flag — check in. Kids band 12/16',
      body: '09:04. The other 11 are already in. Maria scans Layla’s drop-off pass: Omar’s card shows his nut allergy in red, so she ticks “Allergy plan noted” and checks him in. Layla gets “Omar checked in at 09:04 by Maria”.',
      setup: {
        clock: CHECK_IN_AT,
        fixtures: (draft) => arriveSeededMorning(draft, DATE),
        devices: {
          A: { role: 'creche', actorId: STAFF_IDS.crecheMaria, deepLink: 'amali://creche/check' },
        },
      },
      script: [
        {
          command: 'creche.checkIn',
          input: { childId: CHILD_IDS.omar, guardianId: 'guardian_layla', allergyAck: true },
          actor: MARIA,
        },
      ],
      expect: (s) => {
        const booking = omarBooking(s);
        if (booking.state !== 'checked_in' || !booking.checkIn?.allergyAck) {
          throw new Error('Expected Omar checked in with the allergy plan acknowledged');
        }
        const load = kidsLoad(s);
        if (load.inRoom !== 12 || load.capacity !== 16) {
          throw new Error(`Expected Kids 12/16, got ${load.inRoom}/${load.capacity}`);
        }
        const pushed = Object.values(s.notifications).some(
          (n) =>
            n.recipientId === PERSONA_IDS.layla && n.body.includes('checked in at 09:04 by Maria'),
        );
        if (!pushed) throw new Error('Expected Layla’s check-in push');
      },
    },
    {
      title: 'Layla’s live card: “In the Playroom” with activity updates',
      body: 'Dual view: Maria sets the activity to Story time; Layla’s card shows In the Playroom · Checked in 09:04, the activity line and the room’s headcount.',
      setup: {
        dualView: true,
        devices: {
          A: {
            role: 'resident',
            actorId: PERSONA_IDS.layla,
            deepLink: 'amali://resident/amenity-detail?key=creche',
          },
          B: { role: 'creche', actorId: STAFF_IDS.crecheMaria },
        },
      },
      script: [{ command: 'creche.setActivity', input: { label: 'Story time' }, actor: MARIA }],
      expect: (s) => {
        if (omarBooking(s).activity?.at(-1)?.label !== 'Story time') {
          throw new Error('Expected Omar’s activity line to read Story time');
        }
      },
    },
    {
      title: 'Grace calls in sick: Kids band over ratio by 4',
      body: '09:40. Console → Rosters: mark Grace’s shift sick. The creche board drops Kids capacity to 8 — “Over ratio by 4” in red — and new check-ins are blocked.',
      setup: {
        clock: SICK_AT,
        dualView: true,
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.cmHana,
            consoleRole: 'community_manager',
            deepLink: 'amali://console/roster',
          },
          B: { role: 'creche', actorId: STAFF_IDS.crecheMaria },
        },
      },
      script: [
        {
          command: 'roster.markSick',
          input: (s: AppState) => ({ shiftId: graceShiftId(s) }),
          actor: HANA,
        },
      ],
      expect: (s) => {
        const load = kidsLoad(s);
        if (load.capacity !== 8 || load.overBy !== 4) {
          throw new Error(
            `Expected Kids capacity 8, over by 4 — got ${load.capacity}, over by ${load.overBy}`,
          );
        }
      },
    },
    {
      title: 'Maria covers the Kids band herself — back to 16, gauge green',
      body: 'On the board, Maria taps Add cover on the Kids band and picks herself (Lead) from the staff on shift. Capacity returns to 16.',
      setup: {
        devices: { A: { role: 'creche', actorId: STAFF_IDS.crecheMaria } },
      },
      script: [
        {
          command: 'creche.addCover',
          input: { band: 'kids', staffId: STAFF_IDS.crecheMaria },
          actor: MARIA,
        },
      ],
      expect: (s) => {
        const load = kidsLoad(s);
        if (load.capacity !== 16 || load.overBy !== 0) {
          throw new Error(`Expected Kids back to 16 and within ratio, got ${load.capacity}`);
        }
      },
    },
    {
      title: 'A Low incident: “minor scrape, plaster applied”',
      body: '10:30. Maria logs a Low minor injury with first aid given. Low incidents reach the parent at check-out, not straight away.',
      setup: {
        clock: INCIDENT_AT,
        devices: { A: { role: 'creche', actorId: STAFF_IDS.crecheMaria } },
      },
      script: [
        {
          command: 'creche.logIncident',
          input: {
            childId: CHILD_IDS.omar,
            type: 'minor_injury',
            severity: 'low',
            description: 'Minor scrape on the knee, plaster applied.',
            witnessId: STAFF_IDS.crecheAisha,
            firstAid: true,
          },
          actor: MARIA,
        },
      ],
      expect: (s) => {
        const incident = Object.values(s.incidents).find((i) => i.childId === CHILD_IDS.omar);
        if (!incident || incident.parentNotifiedAt) {
          throw new Error('Expected a Low incident not yet sent to the parent');
        }
      },
    },
    {
      title: 'An unauthorised nanny arrives: approve on WhatsApp, check out',
      body: '11:55. Joy, a nanny not on Omar’s list, comes to collect. Maria chooses Unauthorised collector; Layla’s WhatsApp gets an approval request with Joy’s photo. Tap Approve — the creche screen goes from “Waiting for parent approval” to approved, and check-out completes.',
      setup: {
        clock: PICKUP_AT,
        dualView: true,
        devices: {
          A: { role: 'creche', actorId: STAFF_IDS.crecheMaria },
          B: { role: 'whatsapp', actorId: PERSONA_IDS.layla },
        },
      },
      script: [
        {
          command: 'creche.requestCollectorApproval',
          input: (s: AppState) => ({
            bookingId: omarBooking(s).id,
            collectorName: 'Joy Santos',
            collectorPhoto: 'JS',
          }),
          actor: MARIA,
        },
        {
          command: 'wa.recordReply',
          input: (s: AppState) => {
            const message = Object.values(s.waMessages).find(
              (m) =>
                m.threadResidentId === PERSONA_IDS.layla &&
                m.buttons?.some((b) => b.action.name === 'creche.decideApproval'),
            );
            if (!message) throw new Error('Expected the approval request on WhatsApp');
            return { waMessageId: message.id, buttonId: 'approve' };
          },
          actor: LAYLA,
        },
        {
          command: 'creche.decideApproval',
          input: (s: AppState) => {
            const booking = omarBooking(s);
            return {
              bookingId: booking.id,
              approvalId: booking.pendingApproval?.id ?? '',
              decision: 'approved',
            };
          },
          actor: LAYLA,
        },
        {
          command: 'creche.checkOut',
          input: (s: AppState) => ({ bookingId: omarBooking(s).id }),
          actor: MARIA,
        },
      ],
      expect: (s) => {
        const booking = omarBooking(s);
        if (
          booking.state !== 'checked_out' ||
          booking.checkOut?.oneTimeApproval?.state !== 'approved'
        ) {
          throw new Error('Expected Omar checked out on an approved one-time pickup');
        }
        if (booking.lateFeeFils || booking.feeFils)
          throw new Error('Expected no fee for an owner collecting on time');
      },
    },
    {
      title: 'Layla sees the incident at check-out and acknowledges',
      body: 'Layla’s Kids’ Club card shows the incident report. She taps Acknowledge; the creche incident list shows “Acknowledged 11:55”.',
      setup: {
        devices: {
          A: {
            role: 'resident',
            actorId: PERSONA_IDS.layla,
            deepLink: 'amali://resident/amenity-detail?key=creche',
          },
        },
      },
      script: [
        {
          command: 'creche.acknowledgeIncident',
          input: (s: AppState) => ({
            incidentId:
              Object.values(s.incidents).find((i) => i.childId === CHILD_IDS.omar)?.id ?? '',
          }),
          actor: LAYLA,
        },
      ],
      expect: (s) => {
        const incident = Object.values(s.incidents).find((i) => i.childId === CHILD_IDS.omar);
        if (!incident?.parentNotifiedAt || !incident.parentAck) {
          throw new Error('Expected the incident notified at check-out and acknowledged');
        }
      },
    },
  ],
};
