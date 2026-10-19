/**
 * Operations — checklists, cleaning, water quality, rosters, incidents,
 * work orders, audit log (TRD §5.7).
 */
import type { BaseEntity, ISODateTime } from './common';
import type { AmenityKey } from './amenity';
import type { AgeBand } from './creche';

export type Priority = 'P1' | 'P2' | 'P3';

/** Occupancy gauge band (PRD M17) — shared vocabulary for domain/ops and ui/RingGauge. */
export type OccupancyBand = 'quiet' | 'moderate' | 'busy';

export interface ChecklistItemDef {
  id: string;
  label: string;
}

export type ChecklistKind = 'opening' | 'midday' | 'closing';

export interface ChecklistTemplate extends BaseEntity {
  amenity: AmenityKey;
  kind: ChecklistKind;
  dueTime: string; // 'HH:mm'
  items: ChecklistItemDef[];
}

export interface ChecklistRunItem {
  itemId: string;
  result: 'pass' | 'fail';
  note?: string;
  photo?: string;
  incidentId?: string;
}

export interface ChecklistRun extends BaseEntity {
  templateId: string;
  date: string; // DateKey
  by: string;
  completedAt?: ISODateTime;
  items: ChecklistRunItem[];
}

export interface CleaningLog extends BaseEntity {
  zone: string;
  at: ISODateTime;
  by: string;
  nextDue: ISODateTime;
}

export interface WaterReading extends BaseEntity {
  at: ISODateTime;
  by: string;
  ph: number;
  freeChlorine: number;
  tempC: number;
  clarity: 'pass' | 'fail';
  outOfRange: string[];
}

export type ShiftState = 'scheduled' | 'sick' | 'swapped';

export interface Shift extends BaseEntity {
  staffId: string;
  date: string; // DateKey
  start: ISODateTime;
  end: ISODateTime;
  amenity?: AmenityKey;
  band?: AgeBand;
  state: ShiftState;
}

export type IncidentSeverity = 'low' | 'medium' | 'high';
export type IncidentSource = 'guard' | 'console' | 'resident' | 'checklist' | 'creche';

export interface Incident extends BaseEntity {
  amenity: AmenityKey | 'creche';
  category: string;
  severity: IncidentSeverity;
  description: string;
  photo?: string;
  raisedBy: string;
  raisedVia: IncidentSource;
  at: ISODateTime;
  childId?: string;
  parentAck?: { at: ISODateTime; by: string };
  workOrderId?: string;
  mergedInto?: string;
}

export type WorkOrderState =
  'open' | 'assigned' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';

export interface WorkOrderAssignee {
  kind: 'staff' | 'vendor';
  id: string;
}

export interface WorkOrderSla {
  respondBy: ISODateTime;
  resolveBy: ISODateTime;
  pausedMs: number;
  pausedSince?: ISODateTime;
  respondedAt?: ISODateTime;
  /** When it entered Resolved — freezes the resolve clock (closing later doesn't move it); cleared on reopen. */
  resolvedAt?: ISODateTime;
  /** Set once a breach notification has gone to the community manager, so the sweep doesn't re-notify every tick. */
  breachNotifiedAt?: ISODateTime;
}

export interface WorkOrderTimelineEntry {
  at: ISODateTime;
  by: string;
  type: string;
  text?: string;
}

export interface WorkOrderResolution {
  note: string;
  afterPhoto?: string;
  costFils?: number;
}

export interface WorkOrder extends BaseEntity {
  incidentId?: string;
  amenity: AmenityKey;
  title: string;
  priority: Priority;
  assignee: WorkOrderAssignee;
  state: WorkOrderState;
  sla: WorkOrderSla;
  timeline: WorkOrderTimelineEntry[];
  resolution?: WorkOrderResolution;
}

export interface AuditEntry extends BaseEntity {
  at: ISODateTime;
  actor: { kind: 'staff' | 'resident' | 'system'; id: string; role?: string };
  action: string;
  target: { type: string; id: string };
  before?: unknown;
  after?: unknown;
  reason?: string;
}
