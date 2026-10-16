/**
 * RSVP commands (PRD §8.2). `rsvp.hold` creates the Rsvp directly in state
 * 'held' — same pattern as padel's `booking.hold` (P3): capacity/seat
 * conflicts fall out of one check against `Rsvp.state`, no separate hold
 * entity. `rsvp.confirm` turns a still-held Rsvp into a real one.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMillisecondsIso, addHoursIso } from '@/lib/time';
import { validateRsvp, type ValidateRsvpAttendee } from '@/domain/events/validate';
import { partyFeeFils } from '@/domain/events/pricing';
import { applyCharge, applyRefund } from '@/domain/wallet/ledger';
import {
  assembleValidateRsvpInput,
  withAttendeeIds,
  advanceEventWaitlistForShowtime,
} from './eventHelpers';
import { notify } from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';
import type { Job } from '@/scheduler/queue';
import type { Rsvp, RsvpAttendee } from '@/types/event';

/** A hold lasts the same window as a padel slot hold — no event-specific number is given in the PRD. */
const RSVP_HOLD_SECONDS = 180;

export interface RsvpHoldInput {
  showtimeId: string;
  attendees: { category: ValidateRsvpAttendee['category']; name: string; seat?: string }[];
}

export interface RsvpConfirmInput {
  rsvpId: string;
}

export interface RsvpCancelInput {
  rsvpId: string;
  /** Omit for a full cancellation; pass specific attendee ids for a partial one (PRD §8.2). */
  attendeeIds?: string[];
}

export interface RsvpMarkAttendanceInput {
  rsvpId: string;
  attended: string[];
  noShow: string[];
  mode: 'live' | 'post';
}

export interface RsvpReleaseExpiredHoldInput {
  rsvpId: string;
}

export interface RsvpSendReminderInput {
  rsvpId: string;
  label: 'T-24h' | 'T-2h';
}

declare module './types' {
  interface CommandRegistry {
    'rsvp.hold': { input: RsvpHoldInput; output: Rsvp };
    'rsvp.bookNow': { input: RsvpHoldInput; output: Rsvp };
    'rsvp.confirm': { input: RsvpConfirmInput; output: Rsvp };
    'rsvp.cancel': { input: RsvpCancelInput; output: Rsvp };
    'rsvp.markAttendance': { input: RsvpMarkAttendanceInput; output: Rsvp };
    'rsvp.releaseExpiredHold': { input: RsvpReleaseExpiredHoldInput; output: undefined };
    'rsvp.sendReminder': { input: RsvpSendReminderInput; output: undefined };
  }
}

function buildRsvp(
  ctx: CommandCtx,
  input: RsvpHoldInput,
  unitId: string,
  bookerId: string,
  state: Rsvp['state'],
): Rsvp {
  const rsvpId = id('rsvp');
  const attendees: RsvpAttendee[] = withAttendeeIds(input.attendees);
  return {
    id: rsvpId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    showtimeId: input.showtimeId,
    unitId,
    bookerId,
    attendees,
    charges: [],
    state,
  };
}

defineCommand<'rsvp.hold'>({
  name: 'rsvp.hold',
  run: (ctx, input) => {
    const resident = ctx.state.residents[ctx.actor.id];
    if (!resident)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Resident not found.' } };
    const unit = ctx.state.units[resident.unitId];
    if (!unit) return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Unit not found.' } };

    const assembled = assembleValidateRsvpInput(ctx, {
      showtimeId: input.showtimeId,
      attendees: input.attendees,
    });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };
    assembled.walletBalanceFils = ctx.state.wallets[unit.id]?.balanceFils ?? 0;

    const result = validateRsvp(assembled);
    if (!result.ok)
      return {
        ok: false,
        error: { code: result.code, message: result.message, params: result.params },
      };

    const rsvp = buildRsvp(ctx, input, unit.id, ctx.actor.id, 'held');
    ctx.state.rsvps[rsvp.id] = rsvp;

    const expiresAt = addMillisecondsIso(ctx.now, RSVP_HOLD_SECONDS * 1000);
    const job: Job = {
      id: `rsvp-hold-expire:${rsvp.id}`,
      type: 'rsvp.holdExpire',
      runAt: expiresAt,
      payload: { rsvpId: rsvp.id },
    };

    return {
      ok: true,
      value: rsvp,
      events: [],
      jobs: [job],
      audit: {
        action: 'rsvp.hold',
        target: { type: 'rsvp', id: rsvp.id },
        after: { showtimeId: input.showtimeId },
      },
    } satisfies CommandResult<Rsvp>;
  },
});

function finalizeConfirmedRsvp(
  ctx: CommandCtx,
  rsvp: Rsvp,
  event: { pricing: Record<string, number> },
  showtimeStart: string,
): Job[] {
  const feeFils = partyFeeFils(rsvp.attendees, event.pricing as never);
  if (feeFils > 0) {
    const { wallet, entry } = applyCharge(ctx.state.wallets[rsvp.unitId], {
      unitId: rsvp.unitId,
      amountFils: feeFils,
      label: 'Event guest fee',
      byResidentId: rsvp.bookerId,
      ref: { type: 'rsvp', id: rsvp.id },
      now: ctx.now,
    });
    ctx.state.wallets[rsvp.unitId] = wallet;
    const entryId = id('ledger');
    ctx.state.ledger[entryId] = { id: entryId, ...entry };
    rsvp.charges = [{ label: entry.label, fils: feeFils }];
  }

  rsvp.state = 'confirmed';
  rsvp.updatedAt = ctx.now;
  notify(
    ctx,
    rsvp.bookerId,
    'RSVP confirmed',
    `You're confirmed for ${showtimeStart}.`,
    'amali://resident/whats-on',
  );

  const jobs: Job[] = [];
  for (const [label, hoursBefore] of [
    ['T-24h', 24],
    ['T-2h', 2],
  ] as const) {
    const runAt = addHoursIso(showtimeStart, -hoursBefore);
    jobs.push({
      id: `event-reminder:${rsvp.id}:${label}`,
      type: 'event.reminder',
      runAt,
      payload: { rsvpId: rsvp.id, label },
    });
  }
  return jobs;
}

defineCommand<'rsvp.bookNow'>({
  name: 'rsvp.bookNow',
  run: (ctx, input) => {
    const resident = ctx.state.residents[ctx.actor.id];
    if (!resident)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Resident not found.' } };
    const unit = ctx.state.units[resident.unitId];
    if (!unit) return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Unit not found.' } };

    const assembled = assembleValidateRsvpInput(ctx, {
      showtimeId: input.showtimeId,
      attendees: input.attendees,
    });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };
    assembled.walletBalanceFils = ctx.state.wallets[unit.id]?.balanceFils ?? 0;

    const result = validateRsvp(assembled);
    if (!result.ok)
      return {
        ok: false,
        error: { code: result.code, message: result.message, params: result.params },
      };

    const rsvp = buildRsvp(ctx, input, unit.id, ctx.actor.id, 'held');
    ctx.state.rsvps[rsvp.id] = rsvp;
    const jobs = finalizeConfirmedRsvp(ctx, rsvp, assembled.event, assembled.showtime.start);

    return {
      ok: true,
      value: rsvp,
      events: [],
      jobs,
      audit: { action: 'rsvp.bookNow', target: { type: 'rsvp', id: rsvp.id } },
    } satisfies CommandResult<Rsvp>;
  },
});

defineCommand<'rsvp.confirm'>({
  name: 'rsvp.confirm',
  run: (ctx, input) => {
    const rsvp = ctx.state.rsvps[input.rsvpId];
    if (!rsvp || rsvp.state !== 'held') {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This hold is no longer available.' },
      };
    }
    if (ctx.actor.kind === 'resident' && rsvp.bookerId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your RSVP.' } };
    }

    const assembled = assembleValidateRsvpInput(ctx, {
      showtimeId: rsvp.showtimeId,
      attendees: rsvp.attendees.map((a) => ({ category: a.category, seat: a.seat })),
      excludeRsvpId: rsvp.id,
    });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };
    assembled.walletBalanceFils = ctx.state.wallets[rsvp.unitId]?.balanceFils ?? 0;

    const result = validateRsvp(assembled);
    if (!result.ok)
      return {
        ok: false,
        error: { code: result.code, message: result.message, params: result.params },
      };

    const jobs = finalizeConfirmedRsvp(ctx, rsvp, assembled.event, assembled.showtime.start);

    return {
      ok: true,
      value: rsvp,
      events: [],
      jobs,
      audit: { action: 'rsvp.confirm', target: { type: 'rsvp', id: rsvp.id } },
    } satisfies CommandResult<Rsvp>;
  },
});

defineCommand<'rsvp.cancel'>({
  name: 'rsvp.cancel',
  run: (ctx, input) => {
    const rsvp = ctx.state.rsvps[input.rsvpId];
    if (!rsvp || rsvp.state !== 'confirmed') {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This RSVP cannot be cancelled.' },
      };
    }
    if (ctx.actor.kind === 'resident' && rsvp.bookerId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your RSVP.' } };
    }
    const showtime = ctx.state.showtimes[rsvp.showtimeId];
    if (!showtime)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Showtime not found.' } };
    const event = ctx.state.events[showtime.eventId];
    const venueRules = event?.venue === 'music' ? rules.music : rules.screening;

    const isPartial = !!input.attendeeIds && input.attendeeIds.length < rsvp.attendees.length;
    const cancelledAttendees = input.attendeeIds
      ? rsvp.attendees.filter((a) => input.attendeeIds?.includes(a.id))
      : rsvp.attendees;

    const onTime = ctx.now < addHoursIso(showtime.start, -venueRules.freeCancellationHoursBefore);
    if (onTime) {
      const refundFils = partyFeeFils(cancelledAttendees, (event?.pricing ?? {}) as never);
      if (refundFils > 0) {
        const { wallet, entry } = applyRefund(ctx.state.wallets[rsvp.unitId], {
          unitId: rsvp.unitId,
          amountFils: refundFils,
          label: 'Event RSVP refund',
          byResidentId: rsvp.bookerId,
          ref: { type: 'rsvp', id: rsvp.id },
          now: ctx.now,
        });
        ctx.state.wallets[rsvp.unitId] = wallet;
        const entryId = id('ledger');
        ctx.state.ledger[entryId] = { id: entryId, ...entry };
      }
    }
    // Late: fees are kept (PRD §8.2: "guest fees are kept, and the cancellation is recorded — but not a strike in v1").

    if (isPartial) {
      rsvp.attendees = rsvp.attendees.filter((a) => !input.attendeeIds?.includes(a.id));
      rsvp.updatedAt = ctx.now;
    } else {
      rsvp.state = onTime ? 'cancelled' : 'late_cancelled';
      rsvp.updatedAt = ctx.now;
    }

    const jobs = advanceEventWaitlistForShowtime(ctx, rsvp.showtimeId);

    return {
      ok: true,
      value: rsvp,
      events: [],
      jobs,
      audit: {
        action: 'rsvp.cancel',
        target: { type: 'rsvp', id: rsvp.id },
        after: { partial: isPartial, onTime },
      },
    } satisfies CommandResult<Rsvp>;
  },
});

defineCommand<'rsvp.markAttendance'>({
  name: 'rsvp.markAttendance',
  run: (ctx, input) => {
    const rsvp = ctx.state.rsvps[input.rsvpId];
    if (!rsvp || rsvp.state !== 'confirmed') {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'Nothing to mark attendance for.' },
      };
    }
    for (const attendee of rsvp.attendees) {
      if (input.attended.includes(attendee.id)) {
        attendee.attendance = 'attended';
        attendee.markedAt = ctx.now;
        attendee.markedBy = ctx.actor.id;
        attendee.mode = input.mode;
      } else if (input.noShow.includes(attendee.id)) {
        attendee.attendance = 'no_show';
        attendee.markedAt = ctx.now;
        attendee.markedBy = ctx.actor.id;
        attendee.mode = input.mode;
      }
    }
    rsvp.updatedAt = ctx.now;

    return {
      ok: true,
      value: rsvp,
      events: [],
      jobs: [],
      audit: {
        action: 'rsvp.markAttendance',
        target: { type: 'rsvp', id: rsvp.id },
        after: { attended: input.attended.length, noShow: input.noShow.length },
      },
    } satisfies CommandResult<Rsvp>;
  },
});

defineCommand<'rsvp.releaseExpiredHold'>({
  name: 'rsvp.releaseExpiredHold',
  run: (ctx, input) => {
    const rsvp = ctx.state.rsvps[input.rsvpId];
    if (!rsvp || rsvp.state !== 'held') {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }
    delete ctx.state.rsvps[input.rsvpId];

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs: [],
      audit: { action: 'rsvp.releaseExpiredHold', target: { type: 'rsvp', id: input.rsvpId } },
    } satisfies CommandResult<undefined>;
  },
});

/**
 * Fired by the `event.reminder` job at T-24h and T-2h (PRD §8.2: "Reminders
 * go out at T−24h and T−2h"). The T-2h reminder carries a "Cancel" WhatsApp
 * quick-reply button — the only one of the two with enough lead time left
 * for a same-day cancellation to still matter to the resident.
 */
defineCommand<'rsvp.sendReminder'>({
  name: 'rsvp.sendReminder',
  run: (ctx, input) => {
    const rsvp = ctx.state.rsvps[input.rsvpId];
    if (!rsvp || rsvp.state !== 'confirmed') {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }
    const showtime = ctx.state.showtimes[rsvp.showtimeId];
    const event = showtime ? ctx.state.events[showtime.eventId] : undefined;
    const title = event?.title ?? 'your event';

    const notifId = id('notif');
    ctx.state.notifications[notifId] = {
      id: notifId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      recipientId: rsvp.bookerId,
      at: ctx.now,
      title: input.label === 'T-2h' ? 'Starting soon' : 'Coming up',
      body: `"${title}" ${input.label === 'T-2h' ? 'starts in about 2 hours.' : 'is tomorrow.'}`,
      deepLink: 'amali://resident/whats-on',
      priority: 'normal',
      read: false,
    };

    const waId = id('wa');
    ctx.state.waMessages[waId] = {
      id: waId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      threadResidentId: rsvp.bookerId,
      dir: 'out',
      at: ctx.now,
      kind: input.label === 'T-2h' ? 'template' : 'text',
      text: `Reminder: "${title}" ${input.label === 'T-2h' ? 'starts in about 2 hours.' : 'is tomorrow.'}`,
      buttons:
        input.label === 'T-2h'
          ? [
              {
                id: 'btn-cancel',
                label: 'Cancel',
                action: { name: 'rsvp.cancel', args: { rsvpId: rsvp.id } },
              },
            ]
          : undefined,
      ticks: 'sent',
    };

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs: [],
      audit: {
        action: 'rsvp.sendReminder',
        target: { type: 'rsvp', id: rsvp.id },
        after: { label: input.label },
      },
    } satisfies CommandResult<undefined>;
  },
});
