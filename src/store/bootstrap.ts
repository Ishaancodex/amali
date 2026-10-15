/**
 * Hydrates the store from `buildSeed` (TRD §8.3 "Reset"). Called on first
 * load when the persisted store is empty (no community yet), and by the
 * presenter's Reset control (PRD §4.1) — built in Phase P1.
 */
import { buildSeed } from '@/seed';
import { useStore } from './index';
import './commands/registerAll';

export function hydrateFromSeed(seed?: string, now?: string): void {
  const nextState = buildSeed(seed, now);
  // A shallow (non-replace) setState: every AppState key is provided and fully
  // overwrites its previous value, while the action methods (not present in
  // `nextState`, which is pure data) are left untouched.
  useStore.setState(nextState);
}

/** True if the store looks un-seeded (e.g. right after a version bump wiped persisted state). */
export function isStoreEmpty(): boolean {
  return Object.keys(useStore.getState().units).length === 0;
}
