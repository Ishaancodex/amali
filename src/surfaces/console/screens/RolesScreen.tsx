'use client';

/**
 * Roles and access (PRD §8.11, Community Manager only): the matrix the
 * console enforces, read straight from `config/rbac.ts` — so what's shown
 * here is what `can()` decides.
 */
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { rbacMatrix, type Capability } from '@/config/rbac';
import { ROLE_LABEL } from '@/config/consoleAccess';
import type { ConsoleRole } from '@/types/demo';

const ROWS: [string, Capability][] = [
  ['Overview dashboard', 'overview_dashboard'],
  ['Change amenity status / hours', 'amenity_status_hours.change'],
  ['Create blackouts', 'blackout.create'],
  ['Programme (recurring blocks)', 'event.manage'],
  ['Edit booking rules', 'booking_rules.edit'],
  ['View bookings and waitlists', 'bookings_waitlists.view'],
  ['Book / cancel on behalf (logged)', 'booking.on_behalf'],
  ['Lift a suspension', 'suspension.lift'],
  ['Waive a fee', 'fee.waive'],
  ['Compose announcements', 'announcement.compose'],
  ['Urgent announcements', 'announcement.compose_urgent'],
  ['Checklists and logs', 'ops.checklists_logs'],
  ['Raise incidents', 'incident.raise'],
  ['Manage incidents', 'incident.manage'],
  ['Work orders', 'work_order.manage'],
  ['Rosters', 'roster.edit'],
  ['Vendors and SLAs — view', 'vendor_sla.view'],
  ['Vendors and SLAs — manage', 'vendor_sla.manage'],
  ['Revenue figures', 'revenue.view'],
  ['Reports and Excel export', 'reports.export'],
  ['Resident PII — full', 'resident_pii.view_full'],
  ['Resident PII — name, unit, phone', 'resident_pii.view_contact'],
  ['Resident PII — masked, with reveal', 'resident_pii.view_masked'],
  ['Roles and access settings', 'roles_access.manage'],
];
const ROLES: ConsoleRole[] = ['community_manager', 'amenity_supervisor', 'call_centre'];

function cell(role: ConsoleRole, cap: Capability): string {
  const g = rbacMatrix[role][cap];
  if (!g || g.scope === 'none') return '—';
  return `${g.scope === 'all' ? '✓' : '✓ assigned'}${g.logged ? ' · logged' : ''}`;
}

export function RolesScreen() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="Roles and access" />
      <div className="flex-1 overflow-auto px-6 pb-6">
        <Card className="overflow-x-auto">
          <table className="text-body-3 w-full">
            <thead>
              <tr className="text-text-muted">
                <th className="py-2 text-start font-normal">Capability</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-2 text-start font-normal">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-text-body">
              {ROWS.map(([label, cap]) => (
                <tr key={cap} className="border-border-card border-t-[0.5px]">
                  <td className="py-1.5">{label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="py-1.5">
                      {cell(r, cap)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
