/**
 * Role-based access matrix (PRD §8.11). Declarative data only — the `can()`
 * function that reads this lives in `domain/rbac/can.ts` so it stays pure
 * TypeScript and testable without React or the store.
 */
import type { ConsoleRole } from '@/types/demo';

export type Capability =
  | 'overview_dashboard'
  | 'amenity_status_hours.change'
  | 'blackout.create'
  | 'event.manage'
  | 'booking_rules.edit'
  | 'bookings_waitlists.view'
  | 'booking.on_behalf'
  | 'suspension.lift'
  | 'fee.waive'
  | 'announcement.compose'
  | 'announcement.compose_urgent'
  | 'ops.checklists_logs'
  | 'incident.raise'
  | 'incident.manage'
  | 'work_order.manage'
  | 'roster.edit'
  | 'vendor_sla.view'
  | 'vendor_sla.manage'
  | 'revenue.view'
  | 'reports.export'
  | 'reports.export_revenue_sheet'
  | 'resident_pii.view_full'
  | 'resident_pii.view_masked'
  | 'resident_pii.reveal'
  | 'roles_access.manage';

export type CapabilityScope = 'all' | 'assigned' | 'none';

export interface CapabilityGrant {
  scope: CapabilityScope;
  /** True if the action is logged to the audit trail when performed under this role. */
  logged?: boolean;
}

export type RbacMatrix = Record<ConsoleRole, Partial<Record<Capability, CapabilityGrant>>>;

const all: CapabilityGrant = { scope: 'all' };
const assigned: CapabilityGrant = { scope: 'assigned' };
const allLogged: CapabilityGrant = { scope: 'all', logged: true };
const assignedLogged: CapabilityGrant = { scope: 'assigned', logged: true };

export const rbacMatrix: RbacMatrix = {
  community_manager: {
    overview_dashboard: all,
    'amenity_status_hours.change': all,
    'blackout.create': all,
    'event.manage': all,
    'booking_rules.edit': all,
    'bookings_waitlists.view': all,
    'booking.on_behalf': allLogged,
    'suspension.lift': allLogged,
    'fee.waive': allLogged,
    'announcement.compose': all,
    'announcement.compose_urgent': all,
    'ops.checklists_logs': all,
    'incident.raise': all,
    'incident.manage': all,
    'work_order.manage': all,
    'roster.edit': all,
    'vendor_sla.view': all,
    'vendor_sla.manage': all,
    'revenue.view': all,
    'reports.export': all,
    'reports.export_revenue_sheet': all,
    'resident_pii.view_full': all,
    'roles_access.manage': all,
  },
  amenity_supervisor: {
    overview_dashboard: assigned,
    'amenity_status_hours.change': assigned,
    'blackout.create': assigned,
    'event.manage': assigned,
    'bookings_waitlists.view': assigned,
    'booking.on_behalf': assignedLogged,
    'suspension.lift': assignedLogged,
    'fee.waive': assignedLogged,
    'announcement.compose': assigned,
    'announcement.compose_urgent': all,
    'ops.checklists_logs': assigned,
    'incident.raise': all,
    'incident.manage': assigned,
    'work_order.manage': assigned,
    'roster.edit': assigned,
    'vendor_sla.view': all,
    'reports.export': assigned,
    'resident_pii.view_masked': all,
  },
  call_centre: {
    overview_dashboard: { scope: 'all' }, // statuses only — enforced by the UI, not the grant
    'bookings_waitlists.view': all,
    'booking.on_behalf': allLogged,
    'incident.raise': all,
    'resident_pii.view_masked': all,
    'resident_pii.reveal': allLogged,
  },
};
