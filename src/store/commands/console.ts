/**
 * Console actions with an audit trail (PRD §8.11):
 *
 * - **Book / cancel on behalf of a resident** — every role may, and every
 *   use is logged with a required reason. The padel command itself runs
 *   as the resident (same rules, quota and fees), then the booking is
 *   marked as made by an agent.
 * - **Reveal** a masked phone number (call-centre) — logged.
 * - **Export** a report — logged with the sheets it contained.
 * - **Schedule** a report ("every Monday at 08:00 by email"; simulated).
 */
import { id } from '@/lib/ids';
import { reject } from '@/domain/rules/errors';
import { getCommandDef } from './registry';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';
import type { Booking, BookingPlayer } from '@/types/booking';
import type { AmenityKey } from '@/types/amenity';
import type { ReportSchedule } from '@/types/report';

export interface BookOnBehalfInput {
  residentId: string;
  start: string;
  durationMinutes: number;
  players: BookingPlayer[];
  reason: string;
}
export interface CancelOnBehalfInput {
  bookingId: string;
  reason: string;
}
export interface PiiRevealInput {
  residentId: string;
  field: 'phone' | 'email';
}
export interface ReportExportLogInput {
  from: string;
  to: string;
  sheets: string[];
}
export interface ReportScheduleInput {
  name: string;
  windowDays: number;
  amenities: AmenityKey[];
  weekday: ReportSchedule['weekday'];
  time: string;
  email: string;
}

declare module './types' {
  interface CommandRegistry {
    'booking.bookOnBehalf': { input: BookOnBehalfInput; output: Booking };
    'booking.cancelOnBehalf': { input: CancelOnBehalfInput; output: Booking };
    'pii.reveal': { input: PiiRevealInput; output: string };
    'report.logExport': { input: ReportExportLogInput; output: undefined };
    'report.schedule': { input: ReportScheduleInput; output: ReportSchedule };
    'report.unschedule': { input: { scheduleId: string }; output: undefined };
  }
}

const NEEDS_REASON = {
  code: 'REASON_REQUIRED',
  message: 'Give a reason — actions on behalf of a resident are logged.',
};

/** Runs a resident command as that resident, inside this command's own update. */
function asResident<N extends 'booking.bookNow' | 'booking.cancel'>(
  ctx: CommandCtx,
  name: N,
  residentId: string,
  input: Parameters<NonNullable<ReturnType<typeof getCommandDef<N>>>['run']>[1],
) {
  const def = getCommandDef(name)!;
  return def.run({ ...ctx, actor: { kind: 'resident', id: residentId } }, input);
}

defineCommand<'booking.bookOnBehalf'>(
  {
    name: 'booking.bookOnBehalf',
    run: (ctx, input) => {
      if (!input.reason.trim()) return { ok: false, error: NEEDS_REASON };
      if (!ctx.state.residents[input.residentId])
        return { ok: false, error: reject('NOT_ELIGIBLE', 'Resident not found.') };
      const result = asResident(ctx, 'booking.bookNow', input.residentId, {
        start: input.start,
        durationMinutes: input.durationMinutes,
        players: input.players,
      });
      if (!result.ok) return result;
      const booking = ctx.state.bookings[result.value.id]!;
      booking.source = 'agent';
      booking.history.push({
        state: booking.state,
        at: ctx.now,
        by: ctx.actor.id,
        note: `On behalf: ${input.reason.trim()}`,
      });
      return {
        ...result,
        value: booking,
        audit: {
          action: 'booking.bookOnBehalf',
          target: { type: 'booking', id: booking.id },
          after: { residentId: input.residentId, start: input.start },
          reason: input.reason.trim(),
        },
      } satisfies CommandResult<Booking>;
    },
  },
  { capability: 'booking.on_behalf', resolveAmenity: () => 'padel' },
);

defineCommand<'booking.cancelOnBehalf'>(
  {
    name: 'booking.cancelOnBehalf',
    run: (ctx, input) => {
      if (!input.reason.trim()) return { ok: false, error: NEEDS_REASON };
      const booking = ctx.state.bookings[input.bookingId];
      if (!booking) return { ok: false, error: reject('NOT_ELIGIBLE', 'Booking not found.') };
      const result = asResident(ctx, 'booking.cancel', booking.bookerId, {
        bookingId: input.bookingId,
      });
      if (!result.ok) return result;
      return {
        ...result,
        value: ctx.state.bookings[input.bookingId]!,
        audit: {
          action: 'booking.cancelOnBehalf',
          target: { type: 'booking', id: input.bookingId },
          reason: input.reason.trim(),
        },
      } satisfies CommandResult<Booking>;
    },
  },
  { capability: 'booking.on_behalf', resolveAmenity: () => 'padel' },
);

defineCommand<'pii.reveal'>(
  {
    name: 'pii.reveal',
    run: (ctx, input) => {
      const resident = ctx.state.residents[input.residentId];
      if (!resident) return { ok: false, error: reject('NOT_ELIGIBLE', 'Resident not found.') };
      return {
        ok: true,
        value: input.field === 'phone' ? resident.phone : resident.email,
        events: [],
        jobs: [],
        audit: {
          action: 'pii.reveal',
          target: { type: 'resident', id: resident.id },
          after: { field: input.field },
        },
      } satisfies CommandResult<string>;
    },
  },
  { capability: 'resident_pii.reveal' },
);

defineCommand<'report.logExport'>(
  {
    name: 'report.logExport',
    run: (_ctx, input) =>
      ({
        ok: true,
        value: undefined,
        events: [],
        jobs: [],
        audit: {
          action: 'report.export',
          target: { type: 'report', id: `${input.from}_${input.to}` },
          after: { sheets: input.sheets },
        },
      }) satisfies CommandResult<undefined>,
  },
  { capability: 'reports.export' },
);

defineCommand<'report.schedule'>(
  {
    name: 'report.schedule',
    run: (ctx, input) => {
      if (!input.name.trim())
        return { ok: false, error: reject('NOT_ELIGIBLE', 'Name the report.') };
      if (!/^[^@\s]+@[^@\s]+$/.test(input.email))
        return { ok: false, error: reject('NOT_ELIGIBLE', 'Enter an email address.') };
      const schedule: ReportSchedule = {
        id: id('rsched'),
        createdAt: ctx.now,
        name: input.name.trim(),
        windowDays: input.windowDays,
        amenities: input.amenities,
        weekday: input.weekday,
        time: input.time,
        email: input.email,
        createdBy: ctx.actor.id,
        role: ctx.actor.role ?? '',
      };
      ctx.state.reportSchedules[schedule.id] = schedule;
      return {
        ok: true,
        value: schedule,
        events: [],
        jobs: [],
        audit: {
          action: 'report.schedule',
          target: { type: 'reportSchedule', id: schedule.id },
          after: { name: schedule.name, weekday: schedule.weekday, time: schedule.time },
        },
      } satisfies CommandResult<ReportSchedule>;
    },
  },
  { capability: 'reports.export' },
);

defineCommand<'report.unschedule'>(
  {
    name: 'report.unschedule',
    run: (ctx, input) => {
      if (!ctx.state.reportSchedules[input.scheduleId])
        return { ok: false, error: reject('NOT_ELIGIBLE', 'Schedule not found.') };
      delete ctx.state.reportSchedules[input.scheduleId];
      return {
        ok: true,
        value: undefined,
        events: [],
        jobs: [],
        audit: {
          action: 'report.unschedule',
          target: { type: 'reportSchedule', id: input.scheduleId },
        },
      } satisfies CommandResult<undefined>;
    },
  },
  { capability: 'reports.export' },
);
