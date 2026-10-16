/**
 * Pure RBAC check (PRD §8.11, TRD §7.1 step 1). No React, no store — just
 * the matrix in `config/rbac.ts` plus the caller's amenity assignment.
 */
import { rbacMatrix, type Capability, type CapabilityGrant } from '@/config/rbac';
import type { ConsoleRole } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';

export interface CanParams {
  consoleRole: ConsoleRole;
  capability: Capability;
  /** The amenity the action targets, if any — checked against the actor's assignment when the grant is scoped. */
  amenity?: AmenityKey;
  /** The staff member's assigned amenities (Staff.assignedAmenities). */
  assignedAmenities?: AmenityKey[];
}

export function grantFor(
  consoleRole: ConsoleRole,
  capability: Capability,
): CapabilityGrant | undefined {
  return rbacMatrix[consoleRole]?.[capability];
}

/** True if `consoleRole` may perform `capability`, scoped to `amenity` when the grant is 'assigned'. */
export function can(params: CanParams): boolean {
  const grant = grantFor(params.consoleRole, params.capability);
  if (!grant || grant.scope === 'none') return false;
  if (grant.scope === 'all') return true;

  // scope === 'assigned': if the action targets a specific amenity, it must be in the actor's assignment.
  if (params.amenity) {
    return (params.assignedAmenities ?? []).includes(params.amenity);
  }
  // No specific amenity target (e.g. a list view) — allowed in principle; the UI narrows the data shown.
  return true;
}

/** True if performing this capability must be written to the audit log. */
export function isLoggedCapability(consoleRole: ConsoleRole, capability: Capability): boolean {
  return grantFor(consoleRole, capability)?.logged === true;
}
