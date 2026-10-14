/**
 * Reporting types (PRD §8.10). KPI calculators and the Excel builder land in
 * Phase P10 — this is the shared vocabulary so other layers can reference
 * report concepts without a circular dependency.
 */
import type { AmenityKey } from './amenity';
import type { Tower } from './community';

export type KpiName =
  | 'utilisation'
  | 'occupancy'
  | 'peak_time'
  | 'no_show_rate'
  | 'late_cancellation_rate'
  | 'waitlist_conversion'
  | 'revenue'
  | 'covers'
  | 'sla_compliance';

export interface ReportRequest {
  kpis: KpiName[];
  from: string; // DateKey
  to: string; // DateKey
  amenities: AmenityKey[];
  towers?: Tower[];
}

export interface HeatmapCell {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hour: number; // 0-23
  value: number;
}

export interface KpiSeriesPoint {
  date: string; // DateKey
  value: number;
}
