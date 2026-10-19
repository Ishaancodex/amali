/**
 * A party-size change (PRD §8.4): resident or host. A growing party is
 * moved or combined onto tables that fit; the deposit follows the new
 * size — a cut more than 24h ahead releases the difference, growth holds
 * more (and needs the wallet to cover it).
 */
import { rules } from '@/config/rules';
import { addHoursIso, fmtDateTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { availableFils, reduceHold } from '@/domain/wallet/holds';
import { validateReservation } from '@/domain/dining/validate';
import type { Reservation } from '@/types/dining';
import { VENUE_LABEL, aed, appendLedger } from './diningHelpers';
import { depositNeeded, ownReservation, type DiningReservationRef } from './dining';
import { defineCommand } from './registry';
import type { CommandResult } from './types';

export interface DiningPartySizeInput extends DiningReservationRef {
  partySize: number;
}

declare module './types' {
  interface CommandRegistry {
    'dining.changePartySize': { input: DiningPartySizeInput; output: Reservation };
  }
}

const dining = rules.dining;

defineCommand<'dining.changePartySize'>({
  name: 'dining.changePartySize',
  run: (ctx, input) => {
    const r = ownReservation(ctx, input.reservationId);
    if (!r || (r.state !== 'confirmed' && r.state !== 'seated')) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Reservation not found.') };
    }
    const { min, max } = dining[r.venue].partySize;
    if (input.partySize < min || input.partySize > max) {
      return {
        ok: false,
        error: reject('GUEST_LIMIT', `${VENUE_LABEL[r.venue]} takes parties of ${min}–${max}.`),
      };
    }
    // Re-check the tables at the reservation's own time — a growing party may need a move or a combined table.
    const check = validateReservation({
      now: addHoursIso(r.start, -dining[r.venue].leadTimeHours - 1),
      venue: r.venue,
      start: r.start,
      partySize: input.partySize,
      zone: r.seatingPref,
      tables: Object.values(ctx.state.tables),
      reservations: Object.values(ctx.state.reservations),
      depositFils: 0,
      availableFils: 0,
      dining,
      exceptId: r.id,
    });
    const fitsCurrent =
      r.tableIds.reduce((s, t) => s + (ctx.state.tables[t]?.seats ?? 0), 0) >= input.partySize;
    if (!fitsCurrent && (!check.ok || !check.allocation)) {
      return {
        ok: false,
        error: reject(
          'SLOT_FULL',
          `No table or combination seats ${input.partySize} at ${fmtDateTime(r.start, 'HH:mm')}.`,
        ),
      };
    }

    // Deposit follows the new size: a cut more than 24h ahead releases the difference; growth holds more.
    const hold = r.depositHoldId ? ctx.state.walletHolds[r.depositHoldId] : undefined;
    const newDeposit = hold ? depositNeeded(ctx, r.residentId, r.venue, input.partySize) : 0;
    if (hold?.state === 'active' && newDeposit !== hold.fils) {
      if (newDeposit < hold.fils) {
        if (r.start > addHoursIso(ctx.now, dining.depositRefundCutoffHours)) {
          const next = reduceHold(hold, newDeposit, ctx.now);
          ctx.state.walletHolds[hold.id] = next.hold;
          appendLedger(ctx, next.entry);
        }
      } else {
        const extra = newDeposit - hold.fils;
        const available = availableFils(
          ctx.state.wallets[r.unitId],
          Object.values(ctx.state.walletHolds),
          r.unitId,
        );
        if (extra > available) {
          return {
            ok: false,
            error: reject(
              'INSUFFICIENT_BALANCE',
              `Top up ${aed(extra - available)} to hold the larger deposit.`,
            ),
          };
        }
        hold.fils = newDeposit;
        hold.updatedAt = ctx.now;
        appendLedger(ctx, {
          createdAt: ctx.now,
          updatedAt: ctx.now,
          unitId: r.unitId,
          at: ctx.now,
          kind: 'hold',
          fils: -extra,
          label: `${hold.label} increased`,
          ref: hold.ref,
        });
      }
    }

    const before = { partySize: r.partySize, tableIds: r.tableIds };
    r.partySize = input.partySize;
    if (!fitsCurrent && check.ok && check.allocation) r.tableIds = check.allocation.tableIds;
    r.updatedAt = ctx.now;
    return {
      ok: true,
      value: r,
      events: [],
      jobs: [],
      audit: {
        action: 'dining.changePartySize',
        target: { type: 'reservation', id: r.id },
        before,
        after: { partySize: r.partySize, tableIds: r.tableIds },
      },
    } satisfies CommandResult<Reservation>;
  },
});
