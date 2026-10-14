/**
 * `dispatch()` (TRD §7.1): look up the command, check RBAC, run it inside
 * an immer-produced update, then append to the audit log and publish
 * events/jobs on success. This is a store slice (not a standalone
 * function) so it can use the store's own `set`/`get`.
 */
import { id } from '@/lib/ids';
import { rng as makeRng } from '@/lib/random';
import { can } from '@/domain/rbac/can';
import type { ConsoleRole } from '@/types/demo';
import type { Actor } from '@/types/common';
import type { AmenityKey } from '@/types/amenity';
import { eventBus } from '../eventBus';
import { getCommandDef } from './registry';
import type { CommandCtx, CommandInput, CommandName, CommandOutput, CommandResult } from './types';
import type { StoreSlice } from '../types';

export interface DispatchActions {
  dispatch: <N extends CommandName>(
    name: N,
    input: CommandInput<N>,
    actor: Actor,
    opts?: { assignedAmenities?: AmenityKey[] },
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

    const now = get().demo.clock.now;
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
            actor: { kind: actor.kind === 'resident' ? 'resident' : actor.kind, id: actor.id, role: actor.role },
            action: result.audit.action,
            target: result.audit.target,
            before: result.audit.before,
            after: result.audit.after,
            reason: result.audit.reason,
          });
        }
        for (const job of result.jobs) {
          draft.jobs[job.id] = job;
        }
      }
    });

    if (result.ok) {
      for (const event of result.events) {
        eventBus.emit(event);
      }
    }

    // See the comment on `result` above — this is the registry's one type boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as any;
  },
});
