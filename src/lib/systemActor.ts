import type { Actor } from '@/types/common';

/** The actor used when the scheduler (not a person) dispatches a command — e.g. a no-show sweep. */
export const SYSTEM_ACTOR: Actor = { kind: 'system', id: 'system' };
