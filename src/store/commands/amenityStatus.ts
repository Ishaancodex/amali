/**
 * Ordinary amenity status/hours control (PRD §8.5): the status model
 * besides emergency closure (P5's `amenity.emergencyClose` owns that one —
 * it has its own urgent-announcement side effects this command doesn't),
 * the weekly hours editor, and date exceptions.
 */
import { id } from '@/lib/ids';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type {
  AmenityKey,
  AmenityStatus,
  HoursException,
  StatusEntry,
  WeeklyHours,
} from '@/types/amenity';

export interface AmenitySetStatusInput {
  amenity: AmenityKey;
  status: Exclude<AmenityStatus, 'emergency'>;
  reason?: string;
  workOrderId?: string;
}

export interface AmenitySetHoursInput {
  amenity: AmenityKey;
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string;
  close: string;
}

export interface AmenityAddExceptionInput {
  amenity: AmenityKey;
  date: string;
  label: string;
  open?: string;
  close?: string;
  closed?: boolean;
}

declare module './types' {
  interface CommandRegistry {
    'amenity.setStatus': { input: AmenitySetStatusInput; output: StatusEntry };
    'amenity.setHours': { input: AmenitySetHoursInput; output: WeeklyHours };
    'amenity.addException': { input: AmenityAddExceptionInput; output: HoursException };
  }
}

defineCommand<'amenity.setStatus'>(
  {
    name: 'amenity.setStatus',
    run: (ctx, input) => {
      const statusId = id('status');
      const entry: StatusEntry = {
        id: statusId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: input.amenity,
        status: input.status,
        reason: input.reason,
        from: ctx.now,
        workOrderId: input.workOrderId,
        setBy: ctx.actor.id,
      };
      ctx.state.amenityStatus.push(entry);

      return {
        ok: true,
        value: entry,
        events: [],
        jobs: [],
        audit: {
          action: 'amenity.setStatus',
          target: { type: 'amenity', id: input.amenity },
          after: { status: input.status, reason: input.reason },
        },
      } satisfies CommandResult<StatusEntry>;
    },
  },
  { capability: 'amenity_status_hours.change', resolveAmenity: (input) => input.amenity },
);

defineCommand<'amenity.setHours'>(
  {
    name: 'amenity.setHours',
    run: (ctx, input) => {
      const existingIndex = ctx.state.hours.findIndex(
        (h) => h.amenity === input.amenity && h.day === input.day,
      );
      const entry: WeeklyHours = {
        amenity: input.amenity,
        day: input.day,
        open: input.open,
        close: input.close,
      };
      if (existingIndex >= 0) {
        ctx.state.hours[existingIndex] = entry;
      } else {
        ctx.state.hours.push(entry);
      }

      return {
        ok: true,
        value: entry,
        events: [],
        jobs: [],
        audit: {
          action: 'amenity.setHours',
          target: { type: 'amenity', id: input.amenity },
          after: { day: input.day, open: input.open, close: input.close },
        },
      } satisfies CommandResult<WeeklyHours>;
    },
  },
  { capability: 'amenity_status_hours.change', resolveAmenity: (input) => input.amenity },
);

defineCommand<'amenity.addException'>(
  {
    name: 'amenity.addException',
    run: (ctx, input) => {
      const exceptionId = id('exc');
      const entry: HoursException = {
        id: exceptionId,
        amenity: input.amenity,
        date: input.date,
        label: input.label,
        open: input.open,
        close: input.close,
        closed: input.closed,
      };
      ctx.state.exceptions[exceptionId] = entry;

      return {
        ok: true,
        value: entry,
        events: [],
        jobs: [],
        audit: {
          action: 'amenity.addException',
          target: { type: 'amenity', id: input.amenity },
          after: { date: input.date, label: input.label },
        },
      } satisfies CommandResult<HoursException>;
    },
  },
  { capability: 'amenity_status_hours.change', resolveAmenity: (input) => input.amenity },
);
