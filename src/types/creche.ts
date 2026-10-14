/**
 * Creche and Kids' Playroom (TRD §5.5).
 */
import type { BaseEntity, ISODateTime } from './common';

export type AgeBand = 'toddlers' | 'kids' | 'juniors';

export interface ChildAllergy {
  text: string;
  severe: boolean;
}

export interface Child extends BaseEntity {
  unitId: string;
  name: string;
  dob: string; // DateKey
  photo: string;
  allergies?: ChildAllergy;
  dietary?: string;
  photoConsent: boolean;
  guardianIds: string[];
  emergencyContact: { name: string; phone: string };
}

export type GuardianApproval = 'approved' | 'pending' | 'rejected';

export interface Guardian extends BaseEntity {
  childIds: string[];
  name: string;
  relation: string;
  phone: string;
  photo: string;
  idLast4: string;
  residentId?: string;
  validUntil?: ISODateTime;
  approval: GuardianApproval;
}

export type CrecheSessionKind = 'morning' | 'afternoon' | 'dropin';

export interface CrecheSession extends BaseEntity {
  date: string; // DateKey
  start: ISODateTime;
  end: ISODateTime;
  kind: CrecheSessionKind;
}

export type CrecheBookingState =
  | 'confirmed'
  | 'waitlisted'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export interface ApprovalRequest extends BaseEntity {
  collectorName: string;
  collectorPhoto: string;
  requestedAt: ISODateTime;
  state: 'pending' | 'approved' | 'denied';
  decidedAt?: ISODateTime;
  decidedBy?: string;
}

export interface CrecheCheckIn {
  at: ISODateTime;
  by: string;
  guardianId: string;
  allergyAck?: boolean;
}

export interface CrecheCheckOut {
  at: ISODateTime;
  by: string;
  guardianId?: string;
  oneTimeApproval?: ApprovalRequest;
}

export interface CrecheBooking extends BaseEntity {
  sessionId: string;
  childId: string;
  bookedBy: string;
  state: CrecheBookingState;
  checkIn?: CrecheCheckIn;
  checkOut?: CrecheCheckOut;
  activity?: { label: string; at: ISODateTime }[];
  lateFeeFils?: number;
}

/** Drives creche capacity for a band on a given day (PRD §8.3). */
export interface BandAssignment {
  date: string; // DateKey
  band: AgeBand;
  staffIds: string[];
}
