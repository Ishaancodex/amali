/**
 * Community and people (TRD §5.1 / PRD §3).
 */
import type { BaseEntity, ISODateTime } from './common';
import type { AmenityKey } from './amenity';

export type Tower = 'east' | 'west';
export type Cluster = 'north' | 'south';
export type UnitKind = 'apartment' | 'duplex' | 'penthouse' | 'villa';

export interface Unit extends BaseEntity {
  id: string; // 'E-1804', 'PV-05', 'PH-02'
  kind: UnitKind;
  tower?: Tower;
  floor?: number;
  cluster?: Cluster;
  amenityRightsHolderId: string; // resident id (owner or tenant)
  leaseEnd?: ISODateTime;
  accessSuspended?: { reason: 'dues' | 'admin'; since: ISODateTime };
}

export type ResidentType = 'owner' | 'tenant' | 'household';
export type WalletRole = 'primary' | 'spender' | 'none';

export interface ResidentChannels {
  appPush: boolean;
  whatsapp: boolean;
  whatsappOptIn: boolean;
  appInstalled: boolean;
}

export interface Resident extends BaseEntity {
  name: string;
  avatar: string;
  unitId: string;
  type: ResidentType;
  phone: string;
  email: string;
  channels: ResidentChannels;
  locale: 'en' | 'ar';
  walletRole: WalletRole;
}

export type StaffRole =
  | 'guard'
  | 'creche_lead'
  | 'creche_carer'
  | 'fnb_manager'
  | 'host'
  | 'chef'
  | 'community_manager'
  | 'amenity_supervisor'
  | 'call_centre'
  | 'lifeguard'
  | 'gym_attendant'
  | 'technician'
  | 'housekeeping';

export interface Staff extends BaseEntity {
  name: string;
  avatar: string;
  role: StaffRole;
  assignedAmenities?: AmenityKey[];
  post?: string;
}

export interface VendorSlaTerms {
  respondMins: number;
  resolveMins: number;
}

export interface VendorRateCardItem {
  item: string;
  fils: number;
}

export interface Vendor extends BaseEntity {
  name: string;
  services: string[];
  contact: { name: string; phone: string };
  contract: { start: ISODateTime; end: ISODateTime };
  sla: Record<'P1' | 'P2' | 'P3', VendorSlaTerms>;
  rateCard: VendorRateCardItem[];
}
