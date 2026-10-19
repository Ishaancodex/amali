/**
 * Who may drop off and collect (PRD §8.3): an approved guardian on the
 * child's list, whose authorisation hasn't expired (e.g. a nanny's
 * contract end date).
 */
import type { Child, Guardian } from '@/types/creche';

export type GuardianCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_listed' | 'pending' | 'rejected' | 'expired';
      message: string;
    };

export function guardianAuthorisation(
  guardian: Guardian | undefined,
  child: Child,
  now: string,
): GuardianCheck {
  if (!guardian || !child.guardianIds.includes(guardian.id)) {
    return {
      ok: false,
      reason: 'not_listed',
      message: `Not an authorised guardian for ${child.name}.`,
    };
  }
  if (guardian.approval === 'pending') {
    return {
      ok: false,
      reason: 'pending',
      message: `${guardian.name} is pending Creche Lead approval.`,
    };
  }
  if (guardian.approval === 'rejected') {
    return {
      ok: false,
      reason: 'rejected',
      message: `${guardian.name} was not approved as a guardian.`,
    };
  }
  if (guardian.validUntil && guardian.validUntil <= now) {
    return {
      ok: false,
      reason: 'expired',
      message: `${guardian.name}'s authorisation expired.`,
    };
  }
  return { ok: true };
}

/** A new guardian who isn't a resident of the child's unit (e.g. a nanny) needs a photo and lead approval. */
export function needsApproval(residentId: string | undefined): boolean {
  return !residentId;
}
