/**
 * `dispatch()` (TRD §7.1): look up the command, check RBAC, run it inside
 * an immer-produced update, then append to the audit log and publish
 * events/jobs on success. This is a store slice (not a standalone
 * function) so it can use the store's own `set`/`get`.
 */
import { current, isDraft } from 'immer';
import { id } from '@/lib/ids';
import { rng as makeRng } from '@/lib/random';
import { can } from '@/domain/rbac/can';
import type { ConsoleRole } from '@/types/demo';
import type { Actor } from '@/types/common';
import type { AmenityKey } from '@/types/amenity';
import { eventBus } from '../eventBus';
import { schedulerEngine } from '@/scheduler/engine';
import { getCommandDef } from './registry';
import type { CommandCtx, CommandInput, CommandName, CommandOutput, CommandResult } from './types';
import type { StoreSlice } from '../types';

export interface DispatchActions {
  dispatch: <N extends CommandName>(
    name: N,
    input: CommandInput<N>,
    actor: Actor,
    opts?: {
      assignedAmenities?: AmenityKey[];
      /**
       * Overrides `demo.clock.now` for this command — used only by job
       * handlers (`scheduler/jobs/*`), which dispatch with the firing
       * job's own `runAt` as `now` (TRD §7.4: "each job sees its own
       * `runAt` as local `now`"), so a multi-day clock jump that fires
       * several jobs in one `runDue` still timestamps each one correctly
       * instead of stamping all of them with the clock's final value.
       */
      now?: string;
    },
  ) => CommandResult<CommandOutput<N>>;
}

declare module '../types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface RootActions extends DispatchActions {}
}

export const createDispatchSlice: StoreSlice<DispatchActions> = (set, get) => ({
  dispatch: (name, input, actor, opts) => {
    const def = getCommandDef(name);
    if (!def) {
      return {
        ok: false,
        error: { code: 'UNKNOWN_COMMAND', message: `No command registered: ${String(name)}` },
      };
    }

    if (def.capability && actor.kind === 'staff' && actor.role) {
      const amenity = def.resolveAmenity?.(input);
      const allowed = can({
        consoleRole: actor.role as ConsoleRole,
        capability: def.capability,
        amenity,
        assignedAmenities: opts?.assignedAmenities,
      });
      if (!allowed) {
        return {
          ok: false,
          error: { code: 'NO_PERMISSION', message: 'Not available for your role.' },
        };
      }
    }

    const now = opts?.now ?? get().demo.clock.now;
    // `def.run` is stored as `unknown` in the runtime registry (see registry.ts) — this cast is
    // the one place that re-asserts the relationship `getCommandDef(name)` already proved by name.
    let result!: CommandResult<unknown>;

    set((draft) => {
      const ctx: CommandCtx = {
        state: draft,
        now,
        actor,
        rng: makeRng(draft.demo.seed, 'cmd', String(name), now),
      };
      result = def.run(ctx, input);

      if (result.ok) {
        if (result.audit) {
          draft.auditLog.push({
            id: id('audit'),
            createdAt: now,
            updatedAt: now,
            at: now,
            actor: {
              kind: actor.kind === 'resident' ? 'resident' : actor.kind,
              id: actor.id,
              role: actor.role,
            },
            action: result.audit.action,
            target: result.audit.target,
            before: result.audit.before,
            after: result.audit.after,
            reason: result.audit.reason,
          });
        }
        // Store a copy in the draft tree, not the job object `result.jobs` itself holds — immer
        // freezes everything reachable from the draft once this producer returns, and the same
        // job object is also handed to `schedulerEngine.queue` (below, after the producer exits)
        // whose `markDone` later mutates it. Aliasing the frozen copy there would throw.
        for (const job of result.jobs) {
          draft.jobs[job.id] = { ...job };
        }
        // A command handler commonly does `const x = ctx.state.foo[id]; ...mutate x...; return
        // { value: x }` — `x` is an immer draft proxy, which is revoked the instant this producer
        // returns. `current()` takes an immutable plain snapshot while the proxy is still live, so
        // callers can keep reading `result.value` after `dispatch()` returns.
        if (isDraft(result.value)) {
          result.value = current(result.value);
        }
      }
    });

    if (result.ok) {
      for (const event of result.events) {
        eventBus.emit(event);
      }
      // `draft.jobs` (above) is the persisted mirror for display/reset; the live
      // `schedulerEngine.queue` is what `useDemoClock`'s `runDue` actually drains, so every job a
      // command creates has to reach both. `enqueue` is idempotent by id, so this is safe even
      // when a job handler (which also goes through `dispatch`) re-creates a job it already spawned.
      for (const job of result.jobs) {
        schedulerEngine.queue.enqueue(job);
      }
    }

    // See the comment on `result` above — this is the registry's one type boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as any;
  },
});
