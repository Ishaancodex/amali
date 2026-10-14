/**
 * The command pattern's shared types (TRD §7.1). Every mutation goes
 * through a command so that RBAC, audit, events and jobs never get skipped.
 *
 * `CommandRegistry` starts empty and each phase's command module augments
 * it via declaration merging — e.g. `domain for padel (P3)` adds
 * `'booking.create': { input: BookingCreateInput; output: Booking }`. This
 * keeps `CommandName` and `dispatch()`'s generics accurate without every
 * phase having to edit this file.
 */
import type { Draft } from 'immer';
import type { Actor } from '@/types/common';
import type { Rng } from '@/lib/random';
import type { Job } from '@/scheduler/queue';
import type { DomainEvent } from '../eventBus';
import type { AppState } from '../types';

export interface CommandCtx {
  state: Draft<AppState>;
  now: string;
  actor: Actor;
  rng: Rng;
}

export interface AuditInput {
  action: string;
  target: { type: string; id: string };
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/**
 * A command failure. `code` is either `'NO_PERMISSION'` (RBAC, TRD §7.1
 * step 1) or a domain `RuleCode` from `domain/rules/errors.ts` (Phase P3) —
 * they share this shape so the UI's `RuleRejection` component (PRD M10)
 * handles both the same way.
 */
export interface CommandError {
  code: string;
  message: string;
  params?: Record<string, string | number>;
  alternatives?: unknown[];
}

export type CommandResult<O> =
  | { ok: true; value: O; events: DomainEvent[]; jobs: Job[]; audit?: AuditInput }
  | { ok: false; error: CommandError };

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CommandRegistry {}

export type CommandName = keyof CommandRegistry;
export type CommandInput<N extends CommandName> = CommandRegistry[N] extends { input: infer I }
  ? I
  : never;
export type CommandOutput<N extends CommandName> = CommandRegistry[N] extends { output: infer O }
  ? O
  : never;

export type CommandRun<N extends CommandName> = (
  ctx: CommandCtx,
  input: CommandInput<N>,
) => CommandResult<CommandOutput<N>>;

export interface CommandDef<N extends CommandName> {
  name: N;
  run: CommandRun<N>;
}
