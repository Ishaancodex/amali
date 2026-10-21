/**
 * Report vocabulary (PRD §8.10–§8.11): sections, amenities, the request
 * and report shapes, and what each console role may report on.
 */
import { grantFor } from '@/domain/rbac/can';
import type { RevenueBreakdown } from '@/domain/reports/kpis';
import type { AmenityKey } from '@/types/amenity';
import type { Tower } from '@/types/community';
import type { ConsoleRole } from '@/types/demo';
import type { HeatmapCell, KpiSeriesPoint } from '@/types/report';
import type { AmenityUtilisation } from './reportUtilisation';

export type ReportSection =
  'utilisation' | 'peak' | 'noshow' | 'trends' | 'revenue' | 'comms' | 'ops';
export const REPORT_SECTIONS: readonly ReportSection[] = [
  'utilisation',
  'peak',
  'noshow',
  'trends',
  'revenue',
  'comms',
  'ops',
];

export const REPORT_AMENITIES: readonly AmenityKey[] = [
  'padel',
  'screening',
  'music',
  'dining',
  'pool',
  'gym',
  'creche',
];
/** PRD §8.11: "Assigned amenities (Pool, Gym, Padel)" — a demo role switch gives the supervisor these. */
export const DEMO_SUPERVISOR_AMENITIES: AmenityKey[] = ['pool', 'gym', 'padel'];

export interface ReportRequest {
  from: string; // DateKey, inclusive
  to: string; // DateKey, inclusive
  amenities: AmenityKey[];
  towers: Tower[]; // empty = all
  sections: ReportSection[];
}

export interface Report {
  request: ReportRequest;
  role: ConsoleRole;
  amenities: AmenityKey[];
  utilisation: AmenityUtilisation[];
  heatmaps: Partial<Record<AmenityKey, HeatmapCell[]>>;
  peaks: { amenity: AmenityKey; cells: HeatmapCell[] }[];
  noShows: {
    byAmenity: {
      amenity: AmenityKey;
      noShowRate?: number;
      lateCancelRate?: number;
      bookings: number;
    }[];
    weekly: { amenity: AmenityKey; points: KpiSeriesPoint[] }[];
    offenders?: { residentId: string; name: string; unitId: string; count: number }[];
  };
  trends: {
    daily: KpiSeriesPoint[];
    byTower: { tower: string; count: number }[];
    byWeekday: { weekday: number; count: number }[];
  };
  revenue?: RevenueBreakdown;
  comms: {
    messages: number;
    recipients: number;
    deliveryRate?: number;
    medianReadMinutes?: number;
  };
  ops: {
    slaCompliance?: number;
    resolved: number;
    openWorkOrders: number;
    checklistCompletion?: number;
    waitlistConversion?: number;
    covers: number;
  };
  /** The resolved work orders behind SLA compliance (the Work orders sheet). */
  workOrders: {
    id: string;
    amenity: AmenityKey;
    title: string;
    priority: string;
    createdAt: string;
    resolvedAt: string;
    withinSla: boolean;
  }[];
}

/** What a role may report on (PRD §8.11 "Reports and Excel export"). */
export function reportScope(
  role: ConsoleRole,
  assigned: AmenityKey[] | undefined,
): { allowed: boolean; amenities: AmenityKey[]; revenue: boolean; offenders: boolean } {
  const grant = grantFor(role, 'reports.export');
  if (!grant || grant.scope === 'none')
    return { allowed: false, amenities: [], revenue: false, offenders: false };
  const amenities =
    grant.scope === 'all'
      ? [...REPORT_AMENITIES]
      : REPORT_AMENITIES.filter((a) =>
          (assigned?.length ? assigned : DEMO_SUPERVISOR_AMENITIES).includes(a),
        );
  return {
    allowed: true,
    amenities,
    revenue: grantFor(role, 'revenue.view')?.scope === 'all',
    offenders: role === 'community_manager',
  };
}
