/**
 * Which capability opens each console route (PRD §8.11: "Each role changes
 * the navigation, the data and the actions. Hidden items are absent from
 * the UI."). Navigation hides a route the role can't open; the route guard
 * shows the no-permission state for a deep link into one; a role switch
 * on a restricted page goes back to Overview.
 */
import { grantFor } from '@/domain/rbac/can';
import type { ConsoleRole } from '@/types/demo';
import type { Capability } from './rbac';

/** 'any' = every console role (e.g. Communications, where the agent views what was sent). */
export const ROUTE_ACCESS: Record<string, Capability | 'any'> = {
  overview: 'overview_dashboard',
  home: 'any',
  'announcement-detail': 'any',
  composer: 'announcement.compose',
  ops: 'ops.checklists_logs',
  checklist: 'ops.checklists_logs',
  water: 'ops.checklists_logs',
  roster: 'roster.edit',
  incidents: 'incident.manage',
  'work-orders': 'work_order.manage',
  'work-order-detail': 'work_order.manage',
  vendors: 'vendor_sla.view',
  'audit-log': 'roles_access.manage',
  programme: 'event.manage',
  'programme-edit': 'event.manage',
  blackout: 'blackout.create',
  reports: 'reports.export',
  residents: 'booking.on_behalf',
  roles: 'roles_access.manage',
};

export function canOpenRoute(role: ConsoleRole | undefined, route: string): boolean {
  if (!role) return false;
  const need = ROUTE_ACCESS[route];
  if (!need || need === 'any') return true;
  const grant = grantFor(role, need);
  return !!grant && grant.scope !== 'none';
}

export const ROLE_LABEL: Record<ConsoleRole, string> = {
  community_manager: 'Community Manager',
  amenity_supervisor: 'Amenity Supervisor',
  call_centre: 'Call-centre Agent',
};
