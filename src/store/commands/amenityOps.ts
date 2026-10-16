/**
 * The emergency-close/reopen flow (PRD §8.7 "Urgent closure flow"): the
 * minimal real slice of amenity-status control P5 needs for its demo
 * moment — the full status/hours editor (ordinary open/limited/maintenance
 * changes, exceptions) is P6's job (§8.5, §8.8).
 */
import { id } from '@/lib/ids';
import { addHoursIso } from '@/lib/time';
import { sendAnnouncementNow } from './commsHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';
import type { Announcement } from '@/types/comms';
import type { AmenityKey } from '@/types/amenity';
import type { StaffRole } from '@/types/community';

export interface AmenityEmergencyCloseInput {
  amenity: AmenityKey;
  reason: string;
}

export interface AmenityReopenInput {
  amenity: AmenityKey;
}

declare module './types' {
  interface CommandRegistry {
    'amenity.emergencyClose': { input: AmenityEmergencyCloseInput; output: Announcement };
    'amenity.reopen': { input: AmenityReopenInput; output: Announcement };
  }
}

/** Which staff role gets the "Clear it" alert for each amenity — only the amenities with a real on-duty role today. */
const GUARD_ROLE_FOR_AMENITY: Partial<Record<AmenityKey, StaffRole>> = {
  pool: 'lifeguard',
  gym: 'gym_attendant',
  padel: 'guard',
};

function notifyGuards(ctx: CommandCtx, amenity: AmenityKey, amenityName: string): void {
  const role = GUARD_ROLE_FOR_AMENITY[amenity];
  if (!role) return;
  for (const staff of Object.values(ctx.state.staff)) {
    if (staff.role !== role) continue;
    const notifId = id('notif');
    ctx.state.notifications[notifId] = {
      id: notifId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      recipientId: staff.id,
      at: ctx.now,
      title: `Clear the ${amenityName}`,
      body: `Emergency closure in effect — please clear the ${amenityName.toLowerCase()} now.`,
      deepLink: `amali://guard/alerts`,
      priority: 'high',
      read: false,
    };
  }
}

defineCommand<'amenity.emergencyClose'>(
  {
    name: 'amenity.emergencyClose',
    run: (ctx, input) => {
      const amenity = ctx.state.amenities[input.amenity];
      if (!amenity) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Amenity not found.' } };
      }

      const statusId = id('status');
      ctx.state.amenityStatus.push({
        id: statusId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: input.amenity,
        status: 'emergency',
        reason: input.reason,
        from: ctx.now,
        setBy: ctx.actor.id,
      });

      const annId = id('ann');
      const announcement: Announcement = {
        id: annId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        type: 'urgent',
        title: `${amenity.name} closed`,
        body: `The ${amenity.name} is closed now due to ${input.reason}. We'll update you as soon as it reopens.`,
        amenityTags: [input.amenity],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push', 'app_banner', 'app_inbox', 'wa_direct', 'wa_channel'],
        banner: {
          style: 'urgent',
          cta: `amali://resident/amenity-detail?key=${input.amenity}`,
          expiresAt: ctx.now,
        },
        schedule: { mode: 'now' },
        state: 'sending',
        createdBy: ctx.actor.id,
      };
      ctx.state.announcements[annId] = announcement;
      // No expiry on an active closure banner — it stays pinned until the "Reopened" banner supersedes it.
      if (announcement.banner) announcement.banner.expiresAt = '9999-12-31T23:59:59.000Z';

      const jobs = sendAnnouncementNow(ctx, announcement);
      notifyGuards(ctx, input.amenity, amenity.name);

      return {
        ok: true,
        value: announcement,
        events: [],
        jobs,
        audit: {
          action: 'amenity.emergencyClose',
          target: { type: 'amenity', id: input.amenity },
          reason: input.reason,
          after: { announcementId: annId },
        },
      } satisfies CommandResult<Announcement>;
    },
  },
  { capability: 'amenity_status_hours.change', resolveAmenity: (input) => input.amenity },
);

defineCommand<'amenity.reopen'>(
  {
    name: 'amenity.reopen',
    run: (ctx, input) => {
      const amenity = ctx.state.amenities[input.amenity];
      if (!amenity) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Amenity not found.' } };
      }

      const openEntry = Object.values(ctx.state.amenityStatus).find(
        (e) => e.amenity === input.amenity && e.status === 'emergency' && !e.to,
      );
      if (openEntry) openEntry.to = ctx.now;

      const statusId = id('status');
      ctx.state.amenityStatus.push({
        id: statusId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: input.amenity,
        status: 'open',
        from: ctx.now,
        setBy: ctx.actor.id,
      });

      const closure = Object.values(ctx.state.announcements)
        .filter(
          (a) => a.type === 'urgent' && a.amenityTags.includes(input.amenity) && a.state === 'sent',
        )
        .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0];

      const annId = id('ann');
      const announcement: Announcement = {
        id: annId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        type: 'general',
        title: `${amenity.name} reopened`,
        body: `The ${amenity.name} has reopened.`,
        amenityTags: [input.amenity],
        audience: closure
          ? { include: [{ kind: 'units', unitIds: [] }], exclude: [] }
          : { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push', 'app_banner', 'app_inbox', 'wa_direct'],
        banner: { style: 'success', expiresAt: addHoursIso(ctx.now, 2) },
        schedule: { mode: 'now' },
        state: 'sending',
        createdBy: ctx.actor.id,
      };
      ctx.state.announcements[annId] = announcement;

      // Reopen reaches exactly who the closure reached, if we have that list — reuse it directly rather than re-resolving an audience clause.
      const jobs = closure?.resolvedRecipientIds
        ? sendAnnouncementNow(ctx, announcement, new Set(closure.resolvedRecipientIds))
        : sendAnnouncementNow(ctx, announcement);

      return {
        ok: true,
        value: announcement,
        events: [],
        jobs,
        audit: {
          action: 'amenity.reopen',
          target: { type: 'amenity', id: input.amenity },
          after: { announcementId: annId },
        },
      } satisfies CommandResult<Announcement>;
    },
  },
  { capability: 'amenity_status_hours.change', resolveAmenity: (input) => input.amenity },
);
