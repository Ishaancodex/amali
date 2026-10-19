/**
 * S5 — Dining: Teppanyaki and the wallet (PRD §15, C1/C6).
 *
 * Deviation: the PRD tops Sofia up AED 500, but then her AED 620 can't
 * cover the AED 1,120 left after the deposit, and settlement falls back to
 * the unit account — not the "rest charged to the wallet" step 4 shows.
 * The scenario tops up AED 2,000 (also a preset) so step 4 plays as
 * written; the AED 500 fallback is covered in tests/unit/dining-commands.
 */
import { PERSONA_IDS, STAFF_IDS, UNIT_IDS } from '@/seed/personaIds';
import { SEEDED_NO_SHOW_ID, seatEveningSoFar } from '@/seed/dining';
import { availableFils } from '@/domain/wallet/holds';
import { aedToFils } from '@/lib/money';
import type { AppState } from '@/store/types';
import type { Scenario } from './types';

const START = '2026-10-14T13:00:00.000Z'; // Wed 14 Oct, 17:00 Dubai — the default demo day, so the live seed matches
const SEATING = '2026-10-14T17:00:00.000Z'; // 21:00
const SEATED_AT = '2026-10-14T17:02:00.000Z'; // 21:02
const NO_SHOW_AT = '2026-10-14T17:31:00.000Z'; // 21:31
const SETTLE_AT = '2026-10-14T18:50:00.000Z'; // 22:50

const SOFIA = { kind: 'resident' as const, id: PERSONA_IDS.sofia };
const ELENA = { kind: 'staff' as const, id: STAFF_IDS.fnbElena, role: 'host' };

function sofiaReservation(s: AppState) {
  const r = Object.values(s.reservations).find(
    (x) => x.residentId === PERSONA_IDS.sofia && x.venue === 'teppanyaki',
  );
  if (!r) throw new Error('Expected Sofia’s Teppanyaki reservation');
  return r;
}

/** The seeded 20:00 terrace four-top (T11) — the one Elena drags to the canal (T17). */
function terraceBooking(s: AppState) {
  const r = Object.values(s.reservations).find(
    (x) =>
      x.venue === 'restaurant' &&
      x.start === '2026-10-14T16:00:00.000Z' &&
      (x.tableIds.includes('T11') || x.tableIds.includes('T17')),
  );
  if (!r) throw new Error('Expected the seeded 20:00 terrace booking on T11');
  return r;
}

function sofiaAvailable(s: AppState) {
  return availableFils(s.wallets[UNIT_IDS.sofia], Object.values(s.walletHolds), UNIT_IDS.sofia);
}

export const s5Dining: Scenario = {
  id: 'S5',
  title: 'Dining: Teppanyaki and the wallet',
  capability: ['C1', 'C6'],
  startAt: START,

  steps: [
    {
      title: 'Sofia books Teppanyaki 21:00 for 4 — a top-up covers the AED 400 deposit',
      body: 'Dining → Teppanyaki → tonight, 4 people, 21:00. The AED 400 deposit is more than her AED 120 available, so the inline top-up sheet opens: top up, then confirm. The deposit shows “On hold”.',
      setup: {
        devices: {
          A: {
            role: 'resident',
            actorId: PERSONA_IDS.sofia,
            deepLink: 'amali://resident/dining-book?venue=teppanyaki',
          },
        },
      },
      script: [
        {
          command: 'wallet.topUp',
          input: { unitId: UNIT_IDS.sofia, amountFils: aedToFils(2000) },
          actor: SOFIA,
        },
        {
          command: 'dining.reserve',
          input: { venue: 'teppanyaki', start: SEATING, partySize: 4, occasion: 'Birthday' },
          actor: SOFIA,
        },
      ],
      expect: (s) => {
        const r = sofiaReservation(s);
        const hold = r.depositHoldId ? s.walletHolds[r.depositHoldId] : undefined;
        if (r.state !== 'confirmed' || hold?.state !== 'active' || hold.fils !== aedToFils(400)) {
          throw new Error('Expected a confirmed reservation with AED 400 on hold');
        }
        if (sofiaAvailable(s) !== aedToFils(2120 - 400))
          throw new Error('Expected AED 1,720 available after the hold');
      },
    },
    {
      title: 'F&B: the booking on the timeline, dinner covers up; drag a table to the canal',
      body: 'Elena’s tablet shows Sofia’s party of 4 on the Teppanyaki counter and the dinner covers counter includes them. On the Restaurant timeline she drags the 20:00 terrace four-top onto a canal-view table; it snaps into place.',
      setup: {
        devices: { A: { role: 'fnb', actorId: STAFF_IDS.fnbElena } },
      },
      script: [
        {
          command: 'dining.moveTables',
          input: (s: AppState) => ({ reservationId: terraceBooking(s).id, tableIds: ['T17'] }),
          actor: ELENA,
        },
      ],
      expect: (s) => {
        if (terraceBooking(s).tableIds[0] !== 'T17')
          throw new Error('Expected the booking moved to canal table T17');
      },
    },
    {
      title: '21:02 — Sofia’s party arrives and is seated',
      body: 'The evening’s earlier parties are already seated. Elena seats Sofia’s four at the counter.',
      setup: {
        clock: SEATED_AT,
        fixtures: (draft) => seatEveningSoFar(draft, SEATING),
        devices: { A: { role: 'fnb', actorId: STAFF_IDS.fnbElena } },
      },
      script: [
        {
          command: 'dining.seat',
          input: (s: AppState) => ({ reservationId: sofiaReservation(s).id }),
          actor: ELENA,
        },
      ],
      expect: (s) => {
        if (sofiaReservation(s).state !== 'seated')
          throw new Error('Expected Sofia’s party seated');
      },
    },
    {
      title: '21:31 — the other 21:00 party is auto-flagged; the no-show forfeits their deposit',
      body: 'At +30 minutes the system flags the couple who never arrived. Elena confirms the no-show: the AED 200 deposit is forfeited, and they get a notification with the policy.',
      setup: {
        clock: NO_SHOW_AT,
        devices: { A: { role: 'fnb', actorId: STAFF_IDS.fnbElena } },
      },
      script: [
        { command: 'dining.markNoShow', input: { reservationId: SEEDED_NO_SHOW_ID }, actor: ELENA },
      ],
      expect: (s) => {
        const r = s.reservations[SEEDED_NO_SHOW_ID]!;
        if (!r.noShowFlaggedAt) throw new Error('Expected the no-show auto-flag at +30 min');
        if (r.state !== 'no_show' || s.walletHolds[r.depositHoldId!]?.state !== 'forfeited') {
          throw new Error('Expected the no-show confirmed and its deposit forfeited');
        }
        const told = Object.values(s.notifications).some(
          (n) => n.recipientId === r.residentId && n.body.includes('deposit is kept'),
        );
        if (!told) throw new Error('Expected the policy notification to the no-show party');
      },
    },
    {
      title: 'Settle Sofia’s bill at AED 1,520 — the deposit applied, the rest from the wallet',
      body: '22:50. Elena settles AED 1,520: the AED 400 deposit is applied and AED 1,120 is charged to the wallet. Sofia’s app gets the receipt.',
      setup: {
        clock: SETTLE_AT,
        dualView: true,
        devices: {
          A: { role: 'fnb', actorId: STAFF_IDS.fnbElena },
          B: { role: 'resident', actorId: PERSONA_IDS.sofia, deepLink: 'amali://resident/wallet' },
        },
      },
      script: [
        {
          command: 'dining.requestBill',
          input: (s: AppState) => ({ reservationId: sofiaReservation(s).id }),
          actor: ELENA,
        },
        {
          command: 'dining.settle',
          input: (s: AppState) => ({
            reservationId: sofiaReservation(s).id,
            totalFils: aedToFils(1520),
          }),
          actor: ELENA,
        },
      ],
      expect: (s) => {
        const bill = sofiaReservation(s).bill;
        if (
          bill?.method !== 'wallet' ||
          bill.depositAppliedFils !== aedToFils(400) ||
          bill.chargedFils !== aedToFils(1120)
        ) {
          throw new Error(
            `Expected deposit AED 400 applied and AED 1,120 to the wallet, got ${JSON.stringify(bill)}`,
          );
        }
        if (s.wallets[UNIT_IDS.sofia]?.balanceFils !== aedToFils(2120 - 1520))
          throw new Error('Expected AED 600 left in the wallet');
        if (sofiaAvailable(s) < 0) throw new Error('Wallet invariant broken');
        const receipt = Object.values(s.notifications).some(
          (n) => n.recipientId === PERSONA_IDS.sofia && n.title === 'Receipt · Teppanyaki',
        );
        if (!receipt) throw new Error('Expected the receipt in Sofia’s app');
      },
    },
  ],
};
