/**
 * Shared creche command plumbing (PRD §8.3): live band capacity read
 * straight from the roster, parent notifications, the session-level
 * rebalance after a roster change, and the pickup/sweep jobs. Mutates
 * `ctx.state` directly — always called from inside a command's `run()`.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMinutesIso, dubaiDateTimeToIso } from '@/lib/time';
import { BAND_LABEL } from '@/domain/creche/bands';
import { bandLoad, planRebalance, staffOnBand, type BandLoad } from '@/domain/creche/capacity';
import type { Job } from '@/scheduler/queue';
import type { AgeBand, CrecheBooking, CrecheSession } from '@/types/creche';
import { notify } from './bookingHelpers';
import type { CommandCtx } from './types';

export const CRECHE_DEEP_LINK = 'amali://resident/amenity-detail?key=creche';

export function crecheBands() {
  return rules.creche.bands;
}

/** Staff on a band for a window, read live from `bandAssignments` minus sick shifts. */
export function bandStaff(
  ctx: CommandCtx,
  date: string,
  band: AgeBand,
  start: string,
  end: string,
): string[] {
  return staffOnBand(
    ctx.state.bandAssignments,
    Object.values(ctx.state.shifts),
    date,
    band,
    start,
    end,
  );
}

/** A band's live load: children in the room now vs the capacity its staff allow for `session`. */
export function liveBandLoad(ctx: CommandCtx, session: CrecheSession, band: AgeBand): BandLoad {
  const inRoom = Object.values(ctx.state.crecheBookings).filter(
    (b) => b.state === 'checked_in' && b.band === band,
  ).length;
  const staff = bandStaff(ctx, session.date, band, session.start, session.end);
  return bandLoad(band, staff, inRoom, crecheBands());
}

/** The session a check-in at `now` belongs to (opens a little before the start). */
export function sessionRunningAt(ctx: CommandCtx, now: string): CrecheSession | undefined {
  const opens = rules.creche.checkInOpensMinutesBefore;
  return Object.values(ctx.state.crecheSessions)
    .filter((s) => s.kind !== 'dropin' && addMinutesIso(s.start, -opens) <= now && now < s.end)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

/** An app push only (no WhatsApp) — e.g. "Omar checked in at 09:04 by Maria". */
export function notifyApp(
  ctx: CommandCtx,
  residentId: string,
  title: string,
  body: string,
  priority: 'normal' | 'high' = 'normal',
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
    deepLink: CRECHE_DEEP_LINK,
    priority,
    read: false,
  };
}

/** App + WhatsApp, for the things a parent must not miss (late pickup, Medium/High incidents, approvals). */
export function notifyParent(
  ctx: CommandCtx,
  residentId: string,
  title: string,
  body: string,
  buttons?: Parameters<typeof notify>[5],
): void {
  notify(ctx, residentId, title, body, CRECHE_DEEP_LINK, buttons);
}

export function staffName(ctx: CommandCtx, staffId: string): string {
  return ctx.state.staff[staffId]?.name ?? 'staff';
}

export function childFirstName(ctx: CommandCtx, childId: string): string {
  return ctx.state.children[childId]?.name.split(' ')[0] ?? 'Your child';
}

/**
 * PRD §8.3 "a carer goes off sick": re-check every not-yet-ended session
 * on `date`, band by band, against the roster as it now stands. Excess
 * confirmed bookings move to the waitlist; freed places confirm the
 * waitlist in booking order. Each moved parent is notified.
 */
export function rebalanceCrecheDate(ctx: CommandCtx, date: string): void {
  const sessions = Object.values(ctx.state.crecheSessions).filter(
    (s) => s.date === date && s.end > ctx.now,
  );
  for (const session of sessions) {
    const inSession = Object.values(ctx.state.crecheBookings).filter(
      (b) => b.sessionId === session.id,
    );
    for (const band of ['toddlers', 'kids', 'juniors'] as const) {
      const capacity = liveBandLoad(ctx, session, band).capacity;
      const plan = planRebalance(
        inSession.filter((b) => b.band === band),
        capacity,
      );
      for (const bookingId of plan.demote) {
        const booking = ctx.state.crecheBookings[bookingId]!;
        booking.state = 'waitlisted';
        booking.updatedAt = ctx.now;
        notifyParent(
          ctx,
          booking.bookedBy,
          'Kids’ Club booking moved to the waitlist',
          `A carer is off sick, so the ${BAND_LABEL[band]} band has fewer places. ${childFirstName(ctx, booking.childId)} is on the waitlist for ${session.kind}; we’ll confirm as soon as a place frees up.`,
        );
      }
      for (const bookingId of plan.promote) {
        const booking = ctx.state.crecheBookings[bookingId]!;
        booking.state = 'confirmed';
        booking.updatedAt = ctx.now;
        notifyParent(
          ctx,
          booking.bookedBy,
          'Kids’ Club place confirmed',
          `${childFirstName(ctx, booking.childId)} is confirmed for the ${session.kind} session.`,
        );
      }
    }
  }
}

/** Reminder at T−15, late-pickup chase after grace, and the day's end-of-day sweep. */
export function checkInJobs(booking: CrecheBooking, session: CrecheSession): Job[] {
  const { latePickup, endOfDaySweepAt } = rules.creche;
  return [
    {
      id: `creche-pickup:${booking.id}`,
      type: 'creche.pickupReminder',
      runAt: addMinutesIso(session.end, -latePickup.reminderMinutesBefore),
      payload: { bookingId: booking.id },
    },
    {
      id: `creche-late:${booking.id}`,
      type: 'creche.latePickup',
      runAt: addMinutesIso(session.end, latePickup.graceMinutes),
      payload: { bookingId: booking.id },
    },
    {
      id: `creche-eod:${session.date}`,
      type: 'creche.endOfDaySweep',
      runAt: dubaiDateTimeToIso(session.date, endOfDaySweepAt),
      payload: { date: session.date },
    },
  ];
}
