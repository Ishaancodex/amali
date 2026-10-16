/**
 * Event waitlist commands (PRD §8.2: "per showtime, by party size"). Mirrors
 * `store/commands/waitlist.ts` (padel), reusing the same `WaitlistEntry`
 * shape with `resourceKey = 'showtime:<id>'`.
 */
import { id } from '@/lib/ids';
import {
  showtimeResourceKey,
  autoAssignSeats,
  withAttendeeIds,
  advanceEventWaitlistForShowtime,
} from './eventHelpers';
import { notify } from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Rsvp } from '@/types/event';
import type { WaitlistEntry } from '@/types/booking';

export interface EventWaitlistJoinInput {
  showtimeId: string;
  partySize: number;
}

export interface EventWaitlistAcceptInput {
  waitlistEntryId: string;
}

export interface EventWaitlistWithdrawInput {
  waitlistEntryId: string;
}

export interface EventWaitlistExpireOfferInput {
  waitlistEntryId: string;
}

declare module './types' {
  interface CommandRegistry {
    'eventWaitlist.join': { input: EventWaitlistJoinInput; output: WaitlistEntry };
    'eventWaitlist.accept': { input: EventWaitlistAcceptInput; output: Rsvp };
    'eventWaitlist.withdraw': { input: EventWaitlistWithdrawInput; output: WaitlistEntry };
    'eventWaitlist.expireOffer': { input: EventWaitlistExpireOfferInput; output: undefined };
  }
}

defineCommand<'eventWaitlist.join'>({
  name: 'eventWaitlist.join',
  run: (ctx, input) => {
    const key = showtimeResourceKey(input.showtimeId);
    const position =
      Object.values(ctx.state.waitlist).filter((w) => w.resourceKey === key).length + 1;
    const entryId = id('wl');
    const entry: WaitlistEntry = {
      id: entryId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      resourceKey: key,
      residentId: ctx.actor.id,
      partySize: input.partySize,
      position,
      state: 'waiting',
    };
    ctx.state.waitlist[entryId] = entry;

    return {
      ok: true,
      value: entry,
      events: [],
      jobs: [],
      audit: {
        action: 'eventWaitlist.join',
        target: { type: 'waitlistEntry', id: entryId },
        after: { resourceKey: key },
      },
    } satisfies CommandResult<WaitlistEntry>;
  },
});

defineCommand<'eventWaitlist.accept'>({
  name: 'eventWaitlist.accept',
  run: (ctx, input) => {
    const entry = ctx.state.waitlist[input.waitlistEntryId];
    if (!entry || entry.state !== 'offered' || !entry.offer) {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This offer is no longer available.' },
      };
    }
    if (ctx.actor.kind === 'resident' && entry.residentId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your offer.' } };
    }
    if (entry.offer.expiresAt <= ctx.now) {
      entry.state = 'expired';
      entry.updatedAt = ctx.now;
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Offer expired.' } };
    }

    const showtimeId = entry.resourceKey.slice(entry.resourceKey.indexOf(':') + 1);
    const resident = ctx.state.residents[entry.residentId];
    const unit = resident ? ctx.state.units[resident.unitId] : undefined;
    if (!resident || !unit) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Resident not found.' } };
    }

    // No per-attendee category/seat picker at acceptance time (PRD doesn't describe one) — the
    // booker plus free household-category seats fill the party, seated automatically.
    const seats = autoAssignSeats(ctx, showtimeId, entry.partySize);
    const attendeeInputs: { category: 'resident' | 'household'; name: string; seat?: string }[] =
      Array.from({ length: entry.partySize }, (_, i) => ({
        category: i === 0 ? 'resident' : 'household',
        name: i === 0 ? resident.name : `Guest of ${resident.name}`,
        seat: seats[i],
      }));

    const rsvpId = id('rsvp');
    const rsvp: Rsvp = {
      id: rsvpId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      showtimeId,
      unitId: unit.id,
      bookerId: entry.residentId,
      attendees: withAttendeeIds(attendeeInputs),
      charges: [],
      state: 'confirmed',
    };
    ctx.state.rsvps[rsvpId] = rsvp;

    entry.state = 'accepted';
    entry.updatedAt = ctx.now;
    for (const sibling of Object.values(ctx.state.waitlist)) {
      if (
        sibling.id !== entry.id &&
        sibling.resourceKey === entry.resourceKey &&
        sibling.state === 'offered'
      ) {
        sibling.state = 'skipped';
        sibling.updatedAt = ctx.now;
      }
    }

    notify(
      ctx,
      entry.residentId,
      'RSVP confirmed',
      'Your waitlist offer is confirmed.',
      'amali://resident/whats-on',
    );

    return {
      ok: true,
      value: rsvp,
      events: [],
      jobs: [],
      audit: { action: 'eventWaitlist.accept', target: { type: 'rsvp', id: rsvpId } },
    } satisfies CommandResult<Rsvp>;
  },
});

defineCommand<'eventWaitlist.withdraw'>({
  name: 'eventWaitlist.withdraw',
  run: (ctx, input) => {
    const entry = ctx.state.waitlist[input.waitlistEntryId];
    if (!entry || (entry.state !== 'waiting' && entry.state !== 'offered')) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Nothing to withdraw.' } };
    }
    entry.state = 'withdrawn';
    entry.updatedAt = ctx.now;
    return {
      ok: true,
      value: entry,
      events: [],
      jobs: [],
      audit: { action: 'eventWaitlist.withdraw', target: { type: 'waitlistEntry', id: entry.id } },
    } satisfies CommandResult<WaitlistEntry>;
  },
});

defineCommand<'eventWaitlist.expireOffer'>({
  name: 'eventWaitlist.expireOffer',
  run: (ctx, input) => {
    const entry = ctx.state.waitlist[input.waitlistEntryId];
    if (!entry || entry.state !== 'offered' || !entry.offer || entry.offer.expiresAt > ctx.now) {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }
    entry.state = 'expired';
    entry.updatedAt = ctx.now;
    notify(
      ctx,
      entry.residentId,
      'Event offer expired',
      'Your waitlist offer expired.',
      'amali://resident/whats-on',
    );

    const showtimeId = entry.resourceKey.slice(entry.resourceKey.indexOf(':') + 1);
    const jobs = advanceEventWaitlistForShowtime(ctx, showtimeId);

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs,
      audit: {
        action: 'eventWaitlist.expireOffer',
        target: { type: 'waitlistEntry', id: entry.id },
      },
    } satisfies CommandResult<undefined>;
  },
});
