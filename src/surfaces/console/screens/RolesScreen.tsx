'use client';

/**
 * Roles and access (PRD §8.11, Community Manager only): the matrix the
 * console enforces, read straight from `config/rbac.ts` — so what's shown
 * here is what `can()` decides.
 */
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { rbacMatrix, type Capability } from '@/config/rbac';
import { useT, type T } from '@/i18n/hooks';
import type { ConsoleRole } from '@/types/demo';

/** [i18n key under console.cap, capability] — in the PRD's order. */
const ROWS = [
  ['overview', 'overview_dashboard'],
  ['statusHours', 'amenity_status_hours.change'],
  ['blackouts', 'blackout.create'],
  ['programme', 'event.manage'],
  ['bookingRules', 'booking_rules.edit'],
  ['viewBookings', 'bookings_waitlists.view'],
  ['onBehalf', 'booking.on_behalf'],
  ['liftSuspension', 'suspension.lift'],
  ['waiveFee', 'fee.waive'],
  ['compose', 'announcement.compose'],
  ['urgent', 'announcement.compose_urgent'],
  ['checklists', 'ops.checklists_logs'],
  ['raiseIncidents', 'incident.raise'],
  ['manageIncidents', 'incident.manage'],
  ['workOrders', 'work_order.manage'],
  ['rosters', 'roster.edit'],
  ['vendorsView', 'vendor_sla.view'],
  ['vendorsManage', 'vendor_sla.manage'],
  ['revenue', 'revenue.view'],
  ['reports', 'reports.export'],
  ['piiFull', 'resident_pii.view_full'],
  ['piiContact', 'resident_pii.view_contact'],
  ['piiMasked', 'resident_pii.view_masked'],
  ['roles', 'roles_access.manage'],
] as const satisfies readonly (readonly [string, Capability])[];
const ROLES: ConsoleRole[] = ['community_manager', 'amenity_supervisor', 'call_centre'];

function cell(role: ConsoleRole, cap: Capability, t: T): string {
  const g = rbacMatrix[role][cap];
  if (!g || g.scope === 'none') return '—';
  return `${g.scope === 'all' ? '✓' : `✓ ${t('console.roles.assigned')}`}${g.logged ? ` · ${t('console.roles.logged')}` : ''}`;
}

export function RolesScreen() {
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.cap.roles')} />
      <div className="flex-1 overflow-auto px-6 pb-6">
        <Card className="overflow-x-auto">
          <table className="text-body-3 w-full">
            <thead>
              <tr className="text-text-muted">
                <th className="py-2 text-start font-normal">{t('console.roles.capability')}</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-2 text-start font-normal">
                    {t(`console.role.${r}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-text-body">
              {ROWS.map(([key, cap]) => (
                <tr key={cap} className="border-border-card border-t-[0.5px]">
                  <td className="py-1.5">{t(`console.cap.${key}`)}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="py-1.5">
                      {cell(r, cap, t)}
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
