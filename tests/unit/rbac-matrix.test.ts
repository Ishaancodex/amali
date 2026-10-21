import { describe, it, expect } from 'vitest';
import { can, grantFor, isLoggedCapability } from '@/domain/rbac/can';
import { maskPhone, piiLevel, residentView } from '@/domain/rbac/pii';
import type { Capability } from '@/config/rbac';
import type { ConsoleRole } from '@/types/demo';

/**
 * Every cell of PRD §8.11, one row per capability: 'all' = ✅, 'assigned' = ✅ for assigned
 * amenities only, '-' = ❌ (hidden or view-only — no grant to act).
 */
type Cell = 'all' | 'assigned' | '-';
const MATRIX: [string, Capability, Cell, Cell, Cell][] = [
  //                                    capability                      CM     Supervisor  Agent
  ['Overview dashboard', 'overview_dashboard', 'all', 'assigned', 'all'],
  ['Change amenity status / hours', 'amenity_status_hours.change', 'all', 'assigned', '-'],
  ['Create blackouts', 'blackout.create', 'all', 'assigned', '-'],
  ['Recurring blocks (programme)', 'event.manage', 'all', 'assigned', '-'],
  ['Edit booking rules', 'booking_rules.edit', 'all', '-', '-'],
  ['View bookings and waitlists', 'bookings_waitlists.view', 'all', 'assigned', 'all'],
  ['Book / cancel on behalf', 'booking.on_behalf', 'all', 'all', 'all'],
  ['Lift a suspension', 'suspension.lift', 'all', 'assigned', '-'],
  ['Waive a fee', 'fee.waive', 'all', 'assigned', '-'],
  ['Compose announcements', 'announcement.compose', 'all', 'assigned', '-'],
  ['Send urgent announcements', 'announcement.compose_urgent', 'all', 'all', '-'],
  ['Checklists and logs', 'ops.checklists_logs', 'all', 'all', '-'],
  ['Raise incidents', 'incident.raise', 'all', 'all', 'all'],
  ['Manage incidents', 'incident.manage', 'all', 'all', '-'],
  ['Work orders', 'work_order.manage', 'all', 'all', '-'],
  ['Rosters (edit)', 'roster.edit', 'all', 'assigned', '-'],
  ['Vendors and SLAs (view)', 'vendor_sla.view', 'all', 'all', '-'],
  ['Vendors and SLAs (manage)', 'vendor_sla.manage', 'all', '-', '-'],
  ['Revenue figures', 'revenue.view', 'all', '-', '-'],
  ['Reports and Excel export', 'reports.export', 'all', 'assigned', '-'],
  ['Revenue sheet', 'reports.export_revenue_sheet', 'all', '-', '-'],
  ['Resident PII — full', 'resident_pii.view_full', 'all', '-', '-'],
  ['Resident PII — name, unit, phone', 'resident_pii.view_contact', '-', 'all', '-'],
  ['Resident PII — masked phone', 'resident_pii.view_masked', '-', '-', 'all'],
  ['Resident PII — reveal (logged)', 'resident_pii.reveal', '-', '-', 'all'],
  ['Roles and access settings', 'roles_access.manage', 'all', '-', '-'],
];
const ROLES: ConsoleRole[] = ['community_manager', 'amenity_supervisor', 'call_centre'];
const ASSIGNED = ['pool', 'gym', 'padel'] as const;

describe('PRD §8.11 — every cell of the role matrix', () => {
  for (const [label, capability, ...cells] of MATRIX) {
    ROLES.forEach((role, i) => {
      const cell = cells[i]!;
      it(`${label} · ${role}: ${cell === '-' ? '❌' : cell === 'all' ? '✅' : '✅ (assigned)'}`, () => {
        const onAssigned = can({
          consoleRole: role,
          capability,
          amenity: 'pool',
          assignedAmenities: [...ASSIGNED],
        });
        const onOther = can({
          consoleRole: role,
          capability,
          amenity: 'dining',
          assignedAmenities: [...ASSIGNED],
        });
        expect(grantFor(role, capability)?.scope ?? '-').toBe(cell);
        expect(onAssigned).toBe(cell !== '-');
        expect(onOther).toBe(cell === 'all');
      });
    });
  }
});

describe('logged actions', () => {
  it('on-behalf bookings are logged for every role; the agent’s reveal is logged', () => {
    for (const role of ROLES) expect(isLoggedCapability(role, 'booking.on_behalf')).toBe(true);
    expect(isLoggedCapability('call_centre', 'resident_pii.reveal')).toBe(true);
    expect(isLoggedCapability('community_manager', 'suspension.lift')).toBe(true);
  });
});

describe('resident PII by role', () => {
  const layla = {
    name: 'Layla Al Mansoori',
    unitId: 'E-1804',
    phone: '+971 50 123 4567',
    email: 'layla@example.com',
  };

  it('masks as the PRD shows: +971 50 ••• ••67', () => {
    expect(maskPhone('+971 50 123 4567')).toBe('+971 50 ••• ••67');
  });

  it('CM full; supervisor name, unit, phone; agent name, unit, masked phone with Reveal', () => {
    expect(piiLevel('community_manager')).toBe('full');
    expect(residentView(layla, 'community_manager')).toMatchObject({
      phone: '+971 50 123 4567',
      email: 'layla@example.com',
      canReveal: false,
    });
    expect(residentView(layla, 'amenity_supervisor')).toEqual({
      name: layla.name,
      unitId: 'E-1804',
      phone: '+971 50 123 4567',
      canReveal: false,
    });
    expect(residentView(layla, 'call_centre')).toEqual({
      name: layla.name,
      unitId: 'E-1804',
      phone: '+971 50 ••• ••67',
      canReveal: true,
    });
    expect(residentView(layla, 'call_centre', true)).toMatchObject({
      phone: '+971 50 123 4567',
      canReveal: false,
    });
  });
});
