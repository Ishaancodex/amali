/**
 * Cross-cutting primitives shared by every domain type (TRD §5).
 * Times are UTC ISO 8601 strings; money is integer fils (AED × 100).
 */

export type ISODateTime = string;
/** 'YYYY-MM-DD', always a Dubai-local calendar date key. */
export type DateKey = string;
export type Fils = number;

export interface BaseEntity {
  id: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ActorKind = 'resident' | 'staff' | 'system';

export interface Actor {
  kind: ActorKind;
  id: string;
  role?: string;
}

export interface Charge {
  label: string;
  fils: Fils;
}
