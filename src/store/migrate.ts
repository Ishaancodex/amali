/**
 * Persist version migration (TRD §8.3). In v1 there's no incremental
 * migration path — raising `STATE_VERSION` (store/slices/demo.ts) just
 * re-seeds. Returning `undefined` tells zustand/persist to fall back to the
 * slices' initial (empty) state; the app bootstrap then calls
 * `demo.reset` to hydrate from `buildSeed`.
 */
import { STATE_VERSION } from './slices/demo';

export function migrate(persistedState: unknown, version: number): unknown {
  if (version !== STATE_VERSION) {
    return undefined;
  }
  return persistedState;
}
