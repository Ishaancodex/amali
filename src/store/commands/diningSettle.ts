/**
 * Settle bill (PRD §8.4): the deposit is applied, a Private Dining bill
 * under the minimum spend gets a "Minimum spend top-up" line, and the rest
 * goes to the wallet — or, when what's available can't cover it, to the
 * unit account as an invoice, flagged. A receipt goes to the resident.
 * Also the two scheduled jobs: the T−3h WhatsApp reminder with Confirm /
 * Cancel, and the +30 min no-show auto-flag the host then confirms.
 */
import { rules } from '@/config/rules';
import { fmtDateTime, fmtTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { planSettlement, releaseHold } from '@/domain/wallet/holds';
import { applyCharge } from '@/domain/wallet/ledger';
import type { Reservation } from '@/types/dining';
import {
  NOT_FNB,
  VENUE_LABEL,
  aed,
  appendLedger,
  fnbRole,
  guestName,
  pushResident,
  tellHosts,
  tellResident,
} from './diningHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';

export interface DiningSettleInput {
  reservationId: string;
  totalFils: number;
}
export interface DiningJobInput {
  reservationId: string;
}

declare module './types' {
  interface CommandRegistry {
    'dining.settle': { input: DiningSettleInput; output: Reservation };
    'dining.sendReminder': { input: DiningJobInput; output: boolean };
    'dining.autoFlagNoShow': { input: DiningJobInput; output: boolean };
  }
}

const dining = rules.dining;

function charge(ctx: CommandCtx, r: Reservation, fils: number, label: string): void {
  if (fils <= 0) return;
  const { wallet, entry } = applyCharge(ctx.state.wallets[r.unitId], {
    unitId: r.unitId,
    amountFils: fils,
    label,
    byResidentId: r.residentId,
    ref: { type: 'reservation', id: r.id },
    now: ctx.now,
  });
  ctx.state.wallets[r.unitId] = wallet;
  appendLedger(ctx, entry);
}

defineCommand<'dining.settle'>({
  name: 'dining.settle',
  run: (ctx, input) => {
    if (!fnbRole(ctx)) return { ok: false, error: NOT_FNB };
    const r = ctx.state.reservations[input.reservationId];
    if (!r || r.state !== 'seated')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Only a seated table can be settled.') };
    if (!Number.isInteger(input.totalFils) || input.totalFils <= 0) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Enter the bill amount.') };
    }
    const venue = VENUE_LABEL[r.venue];

    // A walk-in with no unit pays at the till.
    if (!r.unitId) {
      r.state = 'completed';
      r.bill = {
        totalFils: input.totalFils,
        settledAt: ctx.now,
        method: 'unit_account',
        chargedFils: input.totalFils,
        flagged: 'Walk-in — paid at the till',
      };
      r.updatedAt = ctx.now;
      return {
        ok: true,
        value: r,
        events: [],
        jobs: [],
        audit: {
          action: 'dining.settle',
          target: { type: 'reservation', id: r.id },
          after: r.bill,
        },
      };
    }

    const hold = r.depositHoldId ? ctx.state.walletHolds[r.depositHoldId] : undefined;
    const plan = planSettlement({
      totalFils: input.totalFils,
      minimumSpendFils: r.venue === 'pdr' ? dining.pdr.minimumSpendFils : 0,
      hold,
      wallet: ctx.state.wallets[r.unitId],
      holds: Object.values(ctx.state.walletHolds),
      unitId: r.unitId,
    });

    // The deposit: the applied part is charged and the hold captured; anything over the bill is released.
    if (hold?.state === 'active') {
      if (hold.fils > plan.depositAppliedFils) {
        const { entry } = releaseHold(
          { ...hold, fils: hold.fils - plan.depositAppliedFils },
          ctx.now,
          `${hold.label} — unused part released`,
        );
        appendLedger(ctx, entry);
      }
      ctx.state.walletHolds[hold.id] = { ...hold, state: 'captured', updatedAt: ctx.now };
      charge(ctx, r, plan.depositAppliedFils, `${venue} — deposit applied`);
    }

    let flagged: string | undefined;
    if (plan.method === 'wallet') {
      const billPart = Math.max(0, input.totalFils - plan.depositAppliedFils);
      charge(ctx, r, billPart, `${venue} bill`);
      charge(ctx, r, plan.remainderFils - billPart, 'Minimum spend top-up');
    } else {
      flagged = `Wallet short — ${aed(plan.remainderFils)} invoiced to the unit account`;
      tellHosts(ctx, 'Charged to unit account', `${guestName(ctx, r)}: ${flagged.toLowerCase()}.`, [
        'fnb_manager',
      ]);
    }

    r.state = 'completed';
    r.billRequestedAt ??= ctx.now;
    r.updatedAt = ctx.now;
    r.bill = {
      totalFils: input.totalFils,
      settledAt: ctx.now,
      method: plan.method,
      minimumSpendTopUpFils: plan.minimumSpendTopUpFils || undefined,
      depositAppliedFils: plan.depositAppliedFils || undefined,
      chargedFils: plan.remainderFils,
      flagged,
    };

    const lines = [
      `Bill ${aed(input.totalFils)}`,
      plan.minimumSpendTopUpFils ? `minimum spend top-up ${aed(plan.minimumSpendTopUpFils)}` : '',
      plan.depositAppliedFils ? `deposit ${aed(plan.depositAppliedFils)} applied` : '',
      plan.remainderFils
        ? `${aed(plan.remainderFils)} ${plan.method === 'wallet' ? 'from your wallet' : 'invoiced to your unit account'}`
        : '',
    ].filter(Boolean);
    pushResident(ctx, r.residentId, `Receipt · ${venue}`, `${lines.join(' · ')}.`);

    return {
      ok: true,
      value: r,
      events: [],
      jobs: [],
      audit: { action: 'dining.settle', target: { type: 'reservation', id: r.id }, after: r.bill },
    } satisfies CommandResult<Reservation>;
  },
});

defineCommand<'dining.sendReminder'>({
  name: 'dining.sendReminder',
  run: (ctx, input) => {
    const r = ctx.state.reservations[input.reservationId];
    const due = r?.state === 'confirmed';
    if (due) {
      const args = { reservationId: r.id };
      tellResident(
        ctx,
        r.residentId,
        `${VENUE_LABEL[r.venue]} at ${fmtTime(r.start)}`,
        `Table for ${r.partySize}, ${fmtDateTime(r.start)}. Still coming?`,
        [
          { id: 'confirm', label: 'Confirm', action: { name: 'dining.confirmAttendance', args } },
          { id: 'cancel', label: 'Cancel', action: { name: 'dining.cancel', args } },
        ],
      );
    }
    return { ok: true, value: due, events: [], jobs: [] } satisfies CommandResult<boolean>;
  },
});

defineCommand<'dining.autoFlagNoShow'>({
  name: 'dining.autoFlagNoShow',
  run: (ctx, input) => {
    const r = ctx.state.reservations[input.reservationId];
    const flag = r?.state === 'confirmed' && !r.noShowFlaggedAt;
    if (flag) {
      r.noShowFlaggedAt = ctx.now;
      r.updatedAt = ctx.now;
      tellHosts(
        ctx,
        'Possible no-show',
        `${guestName(ctx, r)} (${r.partySize}) for ${fmtTime(r.start)} hasn’t arrived. Confirm the no-show or seat them.`,
        ['host', 'fnb_manager'],
        'high',
      );
    }
    return { ok: true, value: flag, events: [], jobs: [] } satisfies CommandResult<boolean>;
  },
});
