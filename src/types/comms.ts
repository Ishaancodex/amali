/**
 * Communications — Amali App + WhatsApp (TRD §5.8).
 */
import type { BaseEntity, ISODateTime } from './common';
import type { AmenityKey } from './amenity';
import type { Tower, Cluster } from './community';

export type Channel = 'app_push' | 'app_banner' | 'app_inbox' | 'wa_direct' | 'wa_channel' | 'sms_fallback';

export type AudienceClause =
  | { kind: 'all' }
  | { kind: 'tower'; tower: Tower }
  | { kind: 'floors'; tower: Tower; from: number; to: number }
  | { kind: 'cluster'; cluster: Cluster }
  | { kind: 'units'; unitIds: string[] }
  | { kind: 'bookers'; amenity: AmenityKey; date: string }
  | { kind: 'parents' }
  | { kind: 'optedIn'; topic: AmenityKey };

export interface AudienceRule {
  include: AudienceClause[];
  exclude: AudienceClause[];
}

export type AnnouncementType = 'daily' | 'event' | 'closure' | 'urgent' | 'general';
export type BannerStyle = 'info' | 'warning' | 'urgent' | 'success';

export interface AnnouncementBanner {
  style: BannerStyle;
  cta?: string;
  expiresAt: ISODateTime;
}

export type AnnouncementSchedule =
  | { mode: 'now' }
  | { mode: 'at'; at: ISODateTime }
  | { mode: 'daily'; time: string };

export type AnnouncementState = 'draft' | 'scheduled' | 'sending' | 'sent' | 'recalled';

export interface Announcement extends BaseEntity {
  type: AnnouncementType;
  title: string;
  body: string;
  amenityTags: AmenityKey[];
  audience: AudienceRule;
  channels: Channel[];
  banner?: AnnouncementBanner;
  schedule: AnnouncementSchedule;
  state: AnnouncementState;
  sentAt?: ISODateTime;
  resolvedRecipientIds?: string[];
  editedAt?: ISODateTime;
  createdBy: string;
}

export type DeliveryState =
  | 'queued'
  | 'held_quiet_hours'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped_opt_out';

export interface Delivery extends BaseEntity {
  messageRef: { type: 'announcement' | 'system'; id: string };
  recipientId: string;
  channel: Channel;
  state: DeliveryState;
  times: Partial<Record<'queued' | 'sent' | 'delivered' | 'read' | 'failed', ISODateTime>>;
}

export interface CommandRef {
  name: string;
  args: unknown;
}

export interface WaMessageButton {
  id: string;
  label: string;
  action: CommandRef;
}

export type WaMessageKind = 'text' | 'template' | 'quick_reply_answer';
export type WaTicks = 'sent' | 'delivered' | 'read';

export interface WaMessage extends BaseEntity {
  threadResidentId: string;
  dir: 'in' | 'out';
  at: ISODateTime;
  kind: WaMessageKind;
  text: string;
  buttons?: WaMessageButton[];
  ticks?: WaTicks;
}

export interface ChannelPost extends BaseEntity {
  announcementId: string;
  at: ISODateTime;
  views: number;
  reactions: Record<string, number>;
}

export interface Notification extends BaseEntity {
  recipientId: string;
  at: ISODateTime;
  title: string;
  body: string;
  deepLink: string;
  priority: 'normal' | 'high';
  read: boolean;
}
