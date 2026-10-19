/**
 * Collection (PRD §8.3 step 5): only an authorised guardian may collect;
 * anyone else needs the parent's one-time approval, requested by app and
 * WhatsApp. Check-out charges the tenant fee and any late fee to the
 * wallet, and tells the parent about Low incidents.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { fmtTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { lateFeeFils, sessionFeeFils } from '@/domain/creche/fees';
import { applyCharge } from '@/domain/wallet/ledger';
import { childFirstName, notifyApp, notifyParent } from './crecheHelpers';
import { crecheRole, NOT_STAFF } from './crecheRoom';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { ApprovalRequest, CrecheBooking } from '@/types/creche';

export interface CrecheRequestApprovalInput {
  bookingId: string;
  collectorName: string;
  collectorPhoto: string;
}
export interface CrecheDecideApprovalInput {
  bookingId: string;
  approvalId: string;
  decision: 'approved' | 'denied';
}
export interface CrecheCheckOutInput {
  bookingId: string;
  /** An authorised guardian collecting — or omit to complete an approved one-time pickup. */
  guardianId?: string;
}

declare module './types' {
  interface CommandRegistry {
    'creche.requestCollectorApproval': {
      input: CrecheRequestApprovalInput;
      output: ApprovalRequest;
    };
    'creche.decideApproval': { input: CrecheDecideApprovalInput; output: ApprovalRequest };
    'creche.checkOut': { input: CrecheCheckOutInput; output: CrecheBooking };
  }
}

defineCommand<'creche.requestCollectorApproval'>({
  name: 'creche.requestCollectorApproval',
  run: (ctx, input) => {
    if (!crecheRole(ctx)) return { ok: false, error: NOT_STAFF };
    const booking = ctx.state.crecheBookings[input.bookingId];
    if (!booking || booking.state !== 'checked_in') {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'This child is not checked in.') };
    }
    if (!input.collectorName.trim()) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Enter the collector’s name.') };
    }
    const approval: ApprovalRequest = {
      id: id('approval'),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      collectorName: input.collectorName.trim(),
      collectorPhoto: input.collectorPhoto,
      requestedAt: ctx.now,
      state: 'pending',
    };
    booking.pendingApproval = approval;
    booking.updatedAt = ctx.now;

    const first = childFirstName(ctx, booking.childId);
    const args = { bookingId: booking.id, approvalId: approval.id };
    notifyParent(
      ctx,
      booking.bookedBy,
      `Pickup approval for ${first}`,
      `${approval.collectorName} is here to collect ${first} and isn't on the authorised list. Approve a one-time pickup?`,
      [
        {
          id: 'approve',
          label: 'Approve',
          action: { name: 'creche.decideApproval', args: { ...args, decision: 'approved' } },
        },
        {
          id: 'deny',
          label: 'Deny',
          action: { name: 'creche.decideApproval', args: { ...args, decision: 'denied' } },
        },
      ],
    );

    return {
      ok: true,
      value: approval,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.requestCollectorApproval',
        target: { type: 'crecheBooking', id: booking.id },
        after: { collectorName: approval.collectorName },
      },
    } satisfies CommandResult<ApprovalRequest>;
  },
});

defineCommand<'creche.decideApproval'>({
  name: 'creche.decideApproval',
  run: (ctx, input) => {
    const booking = ctx.state.crecheBookings[input.bookingId];
    const approval = booking?.pendingApproval;
    if (!booking || !approval || approval.id !== input.approvalId || approval.state !== 'pending') {
      return {
        ok: false,
        error: reject('NOT_ELIGIBLE', 'This request has already been answered.'),
      };
    }
    const unitId = ctx.state.residents[ctx.actor.id]?.unitId;
    if (ctx.actor.kind !== 'resident' || unitId !== ctx.state.children[booking.childId]?.unitId) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Only the child’s household can decide.') };
    }
    approval.state = input.decision;
    approval.decidedAt = ctx.now;
    approval.decidedBy = ctx.actor.id;
    approval.updatedAt = ctx.now;
    booking.updatedAt = ctx.now;

    return {
      ok: true,
      value: approval,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.decideApproval',
        target: { type: 'crecheBooking', id: booking.id },
        after: { approvalId: approval.id, decision: input.decision },
      },
    } satisfies CommandResult<ApprovalRequest>;
  },
});

defineCommand<'creche.checkOut'>({
  name: 'creche.checkOut',
  run: (ctx, input) => {
    if (!crecheRole(ctx)) return { ok: false, error: NOT_STAFF };
    const booking = ctx.state.crecheBookings[input.bookingId];
    const child = booking ? ctx.state.children[booking.childId] : undefined;
    const session = booking ? ctx.state.crecheSessions[booking.sessionId] : undefined;
    if (!booking || !child || !session || booking.state !== 'checked_in' || !booking.checkIn) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'This child is not checked in.') };
    }

    const approval = booking.pendingApproval;
    if (input.guardianId) {
      const check = guardianAuthorisation(ctx.state.guardians[input.guardianId], child, ctx.now);
      if (!check.ok) return { ok: false, error: reject('GUARDIAN_NOT_AUTHORISED', check.message) };
    } else if (approval?.state !== 'approved') {
      return {
        ok: false,
        error: reject(
          'GUARDIAN_NOT_AUTHORISED',
          approval?.state === 'pending'
            ? 'Waiting for parent approval.'
            : approval?.state === 'denied'
              ? 'The parent denied this pickup.'
              : 'Only an authorised guardian may collect.',
        ),
      };
    }

    // Fees: tenants pay on actual time (owners are free); a late fee applies to everyone.
    const unit = ctx.state.units[child.unitId];
    const tenant = unit
      ? ctx.state.residents[unit.amenityRightsHolderId]?.type === 'tenant'
      : false;
    const { tenantFeePerHourFils, feeRoundingMinutes, latePickup } = rules.creche;
    const feeFils = tenant
      ? sessionFeeFils(booking.checkIn.at, ctx.now, tenantFeePerHourFils, feeRoundingMinutes)
      : 0;
    const late = lateFeeFils(
      session.end,
      ctx.now,
      latePickup.graceMinutes,
      latePickup.feePer15MinFils,
    );
    const total = feeFils + late;
    if (total > 0) {
      const { wallet, entry } = applyCharge(ctx.state.wallets[child.unitId], {
        unitId: child.unitId,
        amountFils: total,
        label: late > 0 ? 'Kids’ Club (incl. late pickup)' : 'Kids’ Club session',
        byResidentId: booking.bookedBy,
        ref: { type: 'crecheBooking', id: booking.id },
        now: ctx.now,
      });
      ctx.state.wallets[child.unitId] = wallet;
      const ledgerId = id('ledger');
      ctx.state.ledger[ledgerId] = { id: ledgerId, ...entry };
    }

    booking.state = 'checked_out';
    booking.updatedAt = ctx.now;
    booking.feeFils = feeFils || undefined;
    booking.lateFeeFils = late || undefined;
    booking.checkOut = {
      at: ctx.now,
      by: ctx.actor.id,
      guardianId: input.guardianId,
      oneTimeApproval: input.guardianId ? undefined : approval,
    };
    booking.pendingApproval = undefined;
    booking.flaggedAtSweep = undefined;

    const first = childFirstName(ctx, child.id);
    const collector = input.guardianId
      ? ctx.state.guardians[input.guardianId]?.name
      : approval?.collectorName;
    notifyApp(
      ctx,
      booking.bookedBy,
      `${first} checked out`,
      `${first} was collected by ${collector} at ${fmtTime(ctx.now)}.`,
    );

    // Low-severity incidents are told to the parent at check-out (PRD §8.3).
    for (const incident of Object.values(ctx.state.incidents)) {
      if (
        incident.childId === child.id &&
        incident.bookingId === booking.id &&
        !incident.parentNotifiedAt
      ) {
        incident.parentNotifiedAt = ctx.now;
        notifyApp(
          ctx,
          booking.bookedBy,
          `Incident report for ${first}`,
          `${incident.description} Please acknowledge in the app.`,
        );
      }
    }

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.checkOut',
        target: { type: 'crecheBooking', id: booking.id },
        after: {
          guardianId: input.guardianId,
          oneTimeApproval: approval?.id,
          feeFils,
          lateFeeFils: late,
        },
      },
    } satisfies CommandResult<CrecheBooking>;
  },
});
