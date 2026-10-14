/**
 * Runtime command registry (TRD §7.1). `defineCommand` registers a command's
 * handler (and optional RBAC capability) by name; `dispatch` (slices/dispatch.ts)
 * looks it up by the string the UI calls.
 *
 * Internally this stores `unknown` and casts at the type-safe boundary
 * (`defineCommand` / `getCommandDef`'s generic signatures) — `CommandRegistry`
 * is empty until phases register entries (declaration merging in
 * `types.ts`), so a fully generic implementation can't be proven structurally
 * sound against `CommandName = never` yet. Callers still get full type safety.
 */
import type { Capability } from '@/config/rbac';
import type { AmenityKey } from '@/types/amenity';
import type { CommandDef, CommandName, CommandInput } from './types';

export interface DefineCommandOptions<N extends CommandName> {
  /** RBAC capability required to run this command (console actions only — residents skip this). */
  capability?: Capability;
  /** Extracts the amenity the command targets, for 'assigned'-scoped capabilities. */
  resolveAmenity?: (input: CommandInput<N>) => AmenityKey | undefined;
}

export type RegisteredCommand<N extends CommandName> = CommandDef<N> & DefineCommandOptions<N>;

const registry = new Map<string, unknown>();

export function defineCommand<N extends CommandName>(
  def: CommandDef<N>,
  options: DefineCommandOptions<N> = {},
): CommandDef<N> {
  registry.set(def.name as string, { ...def, ...options });
  return def;
}

export function getCommandDef<N extends CommandName>(name: N): RegisteredCommand<N> | undefined {
  return registry.get(name as string) as RegisteredCommand<N> | undefined;
}

/** Test-only: clears every registered command. */
export function __clearCommandRegistry(): void {
  registry.clear();
}
