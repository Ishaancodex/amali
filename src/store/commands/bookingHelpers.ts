/**
 * Shared helpers for the padel command handlers (booking.ts, waitlist.ts,
 * blackout.ts): assembling `ValidateBookingInput` from `ctx.state`, and
 * writing a notification + WhatsApp message pair (PRD §7's "confirmation
 * sent by app push and WhatsApp" — the full notification matrix lands in
 * P5, so this is the minimal direct version).
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMinutesIso, fmtDate, fmtTime } from '@/lib/time';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { resourceKey as makeResourceKey } from '@/domain/booking/slots';
import { planOffer } from '@/domain/booking/waitlistOffer';
import { applyCharge } from '@/domain/wallet/ledger';
import type { ValidateBookingInput } from '@/domain/booking/validate';
import type { Job } from '@/scheduler/queue';
import type { CommandCtx } from './types';
import type { Booking, BookingPlayer } from '@/types/booking';

export function assembleValidateInput(
  ctx: CommandCtx,
  params: { bookerId: string; start: string; durationMinutes: number; players: BookingPlayer[] },
): ValidateBookingInput | { error: string } {
  const resident = ctx.state.residents[params.bookerId];
  if (!resident) return { error: 'Resident not found.' };
  const unit = ctx.state.units[resident.unitId];
  if (!unit) return { error: 'Unit not found.' };

  const amenityBookings = Object.values(ctx.state.bookings).filter((b) => b.amenity === 'padel');
  const suspension = Object.values(ctx.state.suspensions).find(
    (s) =>
      s.residentId === params.bookerId &&
      s.amenity === 'padel' &&
      !s.liftedBy &&
      s.from <= ctx.now &&
      ctx.now < s.to,
  );
  const wallet = ctx.state.wallets[unit.id];

  return {
    now: ctx.now,
    amenity: 'padel',
    start: params.start,
    durationMinutes: params.durationMinutes,
    unit,
    bookerId: params.bookerId,
    players: params.players,
    amenityStatus: selectCurrentStatus(ctx.state, 'padel', ctx.now),
    blackouts: Object.values(ctx.state.blackouts).filter((b) => b.amenity === 'padel'),
    weeklyHours: ctx.state.hours.filter((h) => h.amenity === 'padel'),
    hoursExceptions: Object.values(ctx.state.exceptions).filter((e) => e.amenity === 'padel'),
    amenityBookings,
    unitBookings: amenityBookings.filter((b) => b.unitId === unit.id),
    suspension,
    walletBalanceFils: wallet?.balanceFils ?? 0,
  };
}

/**
 * Writes a Notification + a one-way WaMessage (PRD §7's "confirmation sent
 * by app push and WhatsApp"). Pass `buttons` for a quick-reply message
 * (PRD §8.7's "Reply 1 to book · 2 to pass") — the WhatsApp Thread screen
 * (P5) renders them and runs the embedded command on tap.
 */
export function notify(
  ctx: CommandCtx,
  residentId: string,
  title: string,
  body: string,
  deepLink: string,
  buttons?: { id: string; label: string; action: { name: string; args: unknown } }[],
): void {
  const notifId = id('notif');
  ctx.state.notifications[notifId] = {
    id: notifId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    recipientId: residentId,
    at: ctx.now,
    title,
    body,
    deepLink,
    priority: 'normal',
    read: false,
  };

  const waId = id('wa');
  ctx.state.waMessages[waId] = {
    id: waId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    threadResidentId: residentId,
    dir: 'out',
    at: ctx.now,
    kind: buttons && buttons.length > 0 ? 'template' : 'text',
    text: `${title}\n${body}`,
    buttons,
    ticks: 'sent',
  };
}

/**
 * Offers a freed padel slot to the waitlist (PRD §8.1): sequentially to
 * #1, or to everyone at once under the open-release threshold. Mutates
 * `ctx.state` directly (never calls `dispatch` — this always runs from
 * inside another command's own `run()`, already inside one `set()`) and
 * returns the follow-up jobs for the *caller* to include in its own
 * `CommandResult.jobs`, so `dispatch`'s scheduler bridge enqueues them.
 */
export function advanceWaitlistForResource(ctx: CommandCtx, start: string): Job[] {
  const key = makeResourceKey('padel', start);
  const waiting = Object.values(ctx.state.waitlist)
    .filter((w) => w.resourceKey === key && w.state === 'waiting')
    .sort((a, b) => a.position - b.position);
  if (waiting.length === 0) return [];

  const plan = planOffer(ctx.now, start);
  const toOffer = plan.mode === 'sequential' ? waiting.slice(0, 1) : waiting;
  const jobs: Job[] = [];

  for (const entry of toOffer) {
    entry.state = 'offered';
    entry.offer = { sentAt: ctx.now, expiresAt: plan.expiresAt, mode: plan.mode };
    entry.updatedAt = ctx.now;
    notify(
      ctx,
      entry.residentId,
      'Padel slot available',
      `Court free ${fmtDate(start, 'EEE')} ${fmtTime(start)}. Reply 1 to book · 2 to pass.`,
      'amali://resident/amenity-detail?key=padel',
      [
        {
          id: 'book',
          label: '1',
          action: { name: 'waitlist.accept', args: { waitlistEntryId: entry.id } },
        },
        {
          id: 'pass',
          label: '2',
          action: { name: 'waitlist.withdraw', args: { waitlistEntryId: entry.id } },
        },
      ],
    );
    jobs.push({
      id: `wl-offer-expire:${entry.id}:${plan.expiresAt}`,
      type: 'waitlist.offerExpire',
      runAt: plan.expiresAt,
      payload: { waitlistEntryId: entry.id },
    });
  }

  return jobs;
}

/**
 * The "turn a validated booking into a real, paid-for, swept-for-no-shows
 * one" steps shared by `booking.confirm`, `booking.bookNow` and
 * `booking.priorityRebook`: charges any guest fee, sets `state`/history,
 * schedules the no-show sweep, and notifies the booker. Returns the
 * no-show job for the caller to include in its own `CommandResult.jobs`.
 */
export function finalizeConfirmedBooking(
  ctx: CommandCtx,
  booking: Booking,
  historyNote?: string,
): Job {
  const guests = booking.players.filter((p) => p.guestName);
  const guestFeeFils = guests.length * rules.padel.guestFeeFils;

  if (guestFeeFils > 0) {
    const { wallet, entry } = applyCharge(ctx.state.wallets[booking.unitId], {
      unitId: booking.unitId,
      amountFils: guestFeeFils,
      label: `Padel guest fee × ${guests.length}`,
      byResidentId: booking.bookerId,
      ref: { type: 'booking', id: booking.id },
      now: ctx.now,
    });
    ctx.state.wallets[booking.unitId] = wallet;
    const entryId = id('ledger');
    ctx.state.ledger[entryId] = { id: entryId, ...entry };
    booking.charges = [{ label: entry.label, fils: guestFeeFils }];
  }

  booking.state = 'confirmed';
  booking.updatedAt = ctx.now;
  booking.history.push({
    state: 'confirmed',
    at: ctx.now,
    by: booking.bookerId,
    note: historyNote,
  });

  notify(
    ctx,
    booking.bookerId,
    'Padel booking confirmed',
    `Your padel court is booked for ${booking.start}.`,
    'amali://resident/amenity-detail?key=padel',
  );

  return {
    id: `noshow:${booking.id}`,
    type: 'booking.noShowSweep',
    runAt: addMinutesIso(booking.start, rules.padel.noShowGraceMinutes),
    payload: { bookingId: booking.id },
  };
}
