/**
 * Announcement commands (PRD §8.7): the composer's "Publish" action, a
 * recall, an edit, and the scheduled/recurring send (fired by the
 * `announcement.send` job) plus the delivery-simulator ticks (fired by
 * `delivery.tick`/`quietHours.release`). System-only commands (fired only
 * by jobs) carry no `capability`, matching `booking.releaseExpiredHold`'s
 * pattern.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { can } from '@/domain/rbac/can';
import { resolveAudience } from '@/domain/comms/audience';
import { resolveDeliveryState, planDeliveryTimes } from '@/domain/comms/delivery';
import { rng } from '@/lib/random';
import { addMillisecondsIso, minutesBetween } from '@/lib/time';
import {
  buildAudienceContext,
  sendAnnouncementNow,
  deliveryTickJob,
  nextDailyOccurrence,
  writeWaMessageForDelivery,
} from './commsHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Job } from '@/scheduler/queue';
import type { ConsoleRole } from '@/types/demo';
import type {
  Announcement,
  AnnouncementSchedule,
  AnnouncementType,
  AudienceRule,
  BannerStyle,
  Channel,
} from '@/types/comms';
import type { AmenityKey } from '@/types/amenity';

export interface AnnouncementCreateInput {
  type: AnnouncementType;
  title: string;
  body: string;
  amenityTags: AmenityKey[];
  audience: AudienceRule;
  channels: Channel[];
  banner?: { style: BannerStyle; cta?: string; expiresAt: string };
  schedule: AnnouncementSchedule;
}

export interface AnnouncementRecallInput {
  announcementId: string;
}

export interface AnnouncementEditInput {
  announcementId: string;
  title?: string;
  body?: string;
}

export interface AnnouncementFireScheduledInput {
  announcementId: string;
}

export interface CommsTickDeliveriesInput {
  runAt: string;
}

export interface CommsReleaseQuietHoursInput {
  runAt: string;
}

declare module './types' {
  interface CommandRegistry {
    'announcement.create': { input: AnnouncementCreateInput; output: Announcement };
    'announcement.recall': { input: AnnouncementRecallInput; output: Announcement };
    'announcement.edit': { input: AnnouncementEditInput; output: Announcement };
    'announcement.fireScheduled': { input: AnnouncementFireScheduledInput; output: undefined };
    'comms.tickDeliveries': { input: CommsTickDeliveriesInput; output: undefined };
    'comms.releaseQuietHours': { input: CommsReleaseQuietHoursInput; output: undefined };
  }
}

defineCommand<'announcement.create'>(
  {
    name: 'announcement.create',
    run: (ctx, input) => {
      if (!input.title.trim() || !input.body.trim()) {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'Title and body are required.' },
        };
      }
      if (input.type === 'urgent' && ctx.actor.kind === 'staff' && ctx.actor.role) {
        const allowed = can({
          consoleRole: ctx.actor.role as ConsoleRole,
          capability: 'announcement.compose_urgent',
        });
        if (!allowed) {
          return {
            ok: false,
            error: {
              code: 'NO_PERMISSION',
              message: 'Urgent announcements need a Community Manager or Amenity Supervisor.',
            },
          };
        }
      }

      const audienceCtx = buildAudienceContext(ctx);
      const matched = resolveAudience(input.audience, audienceCtx);
      if (matched.length === 0) {
        return {
          ok: false,
          error: { code: 'EMPTY_AUDIENCE', message: 'This audience matches no residents.' },
        };
      }

      const annId = id('ann');
      const announcement: Announcement = {
        id: annId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        type: input.type,
        title: input.title,
        body: input.body,
        amenityTags: input.amenityTags,
        audience: input.audience,
        channels: input.channels,
        banner: input.banner,
        schedule: input.schedule,
        state: input.schedule.mode === 'now' ? 'sending' : 'scheduled',
        createdBy: ctx.actor.id,
      };
      ctx.state.announcements[annId] = announcement;

      let jobs: Job[];
      if (input.schedule.mode === 'now') {
        jobs = sendAnnouncementNow(ctx, announcement);
      } else {
        const runAt =
          input.schedule.mode === 'at'
            ? input.schedule.at
            : nextDailyOccurrence(ctx.now, input.schedule.time);
        jobs = [
          {
            id: `announcement-send:${annId}:${runAt}`,
            type: 'announcement.send',
            runAt,
            payload: { announcementId: annId },
          },
        ];
      }

      return {
        ok: true,
        value: announcement,
        events: [],
        jobs,
        audit: {
          action: 'announcement.create',
          target: { type: 'announcement', id: annId },
          after: { type: input.type, schedule: input.schedule.mode, audienceSize: matched.length },
        },
      } satisfies CommandResult<Announcement>;
    },
  },
  {
    capability: 'announcement.compose',
    resolveAmenity: (input) => (input.amenityTags.length === 1 ? input.amenityTags[0] : undefined),
  },
);

defineCommand<'announcement.fireScheduled'>({
  name: 'announcement.fireScheduled',
  run: (ctx, input) => {
    const announcement = ctx.state.announcements[input.announcementId];
    if (!announcement || announcement.state === 'recalled') {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }

    const jobs = sendAnnouncementNow(ctx, announcement);

    if (announcement.schedule.mode === 'daily') {
      announcement.state = 'scheduled'; // a recurring send goes back to "scheduled" rather than terminal "sent"
      const nextRunAt = nextDailyOccurrence(
        addMillisecondsIso(ctx.now, 1),
        announcement.schedule.time,
      );
      jobs.push({
        id: `announcement-send:${announcement.id}:${nextRunAt}`,
        type: 'announcement.send',
        runAt: nextRunAt,
        payload: { announcementId: announcement.id },
      });
    }

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs,
      audit: {
        action: 'announcement.fireScheduled',
        target: { type: 'announcement', id: announcement.id },
      },
    } satisfies CommandResult<undefined>;
  },
});

defineCommand<'announcement.recall'>(
  {
    name: 'announcement.recall',
    run: (ctx, input) => {
      const announcement = ctx.state.announcements[input.announcementId];
      if (!announcement || announcement.state !== 'sent') {
        return {
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: 'Only a sent message can be recalled.' },
        };
      }
      announcement.state = 'recalled';
      announcement.updatedAt = ctx.now;
      return {
        ok: true,
        value: announcement,
        events: [],
        jobs: [],
        audit: {
          action: 'announcement.recall',
          target: { type: 'announcement', id: announcement.id },
        },
      } satisfies CommandResult<Announcement>;
    },
  },
  { capability: 'announcement.compose' },
);

defineCommand<'announcement.edit'>(
  {
    name: 'announcement.edit',
    run: (ctx, input) => {
      const announcement = ctx.state.announcements[input.announcementId];
      if (!announcement) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Announcement not found.' } };
      }
      if (input.title !== undefined) announcement.title = input.title;
      if (input.body !== undefined) announcement.body = input.body;
      announcement.editedAt = ctx.now;
      announcement.updatedAt = ctx.now;
      return {
        ok: true,
        value: announcement,
        events: [],
        jobs: [],
        audit: {
          action: 'announcement.edit',
          target: { type: 'announcement', id: announcement.id },
        },
      } satisfies CommandResult<Announcement>;
    },
  },
  { capability: 'announcement.compose' },
);

/**
 * The global delivery-simulator sweep (TRD §7.5): re-derives every
 * non-terminal `Delivery`'s state from its precomputed `times` plan, runs
 * the urgent SMS-fallback check, and reschedules itself (a fresh job id
 * per tick) while anything is still pending.
 */
defineCommand<'comms.tickDeliveries'>({
  name: 'comms.tickDeliveries',
  run: (ctx) => {
    let pending = false;

    for (const delivery of Object.values(ctx.state.deliveries)) {
      if (
        delivery.state === 'read' ||
        delivery.state === 'failed' ||
        delivery.state === 'skipped_opt_out' ||
        delivery.state === 'held_quiet_hours'
      ) {
        continue;
      }
      const nextState = resolveDeliveryState(delivery.times, ctx.now);
      if (nextState !== delivery.state) {
        delivery.state = nextState;
        delivery.updatedAt = ctx.now;
      }
      // Keep ticking only while this delivery still has a planned step ahead — one that was
      // delivered and simply never read must not keep the sweep rescheduling forever.
      if (Object.values(delivery.times).some((t) => !!t && t > ctx.now)) pending = true;
    }

    // Urgent SMS fallback (PRD §8.7): if WhatsApp isn't delivered within the configured window, log an SMS fallback.
    for (const announcement of Object.values(ctx.state.announcements)) {
      if (announcement.type !== 'urgent' || !announcement.sentAt) continue;
      const fallbackDueAt = addMillisecondsIso(
        announcement.sentAt,
        rules.comms.urgentSmsFallbackAfterMinutes * 60 * 1000,
      );
      if (ctx.now < fallbackDueAt) continue;
      for (const delivery of Object.values(ctx.state.deliveries)) {
        if (
          delivery.messageRef.type !== 'announcement' ||
          delivery.messageRef.id !== announcement.id
        )
          continue;
        if (delivery.channel !== 'wa_direct') continue;
        if (delivery.state === 'delivered' || delivery.state === 'read') continue;
        const alreadyFalling = Object.values(ctx.state.deliveries).some(
          (d) =>
            d.channel === 'sms_fallback' &&
            d.recipientId === delivery.recipientId &&
            d.messageRef.id === announcement.id,
        );
        if (alreadyFalling) continue;
        const smsId = id('delivery');
        ctx.state.deliveries[smsId] = {
          id: smsId,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          messageRef: delivery.messageRef,
          recipientId: delivery.recipientId,
          channel: 'sms_fallback',
          state: 'delivered',
          times: { queued: ctx.now, sent: ctx.now, delivered: ctx.now },
        };
      }
    }

    // Channel posts get aggregate views only, no per-recipient rows (PRD §8.7) — recomputed fresh
    // each tick from a deterministic target (a seeded fraction of the resolved audience) and a
    // smooth growth curve, so there's nothing to drift or double-count.
    for (const post of Object.values(ctx.state.channelPosts)) {
      const announcement = ctx.state.announcements[post.announcementId];
      const audienceSize = announcement?.resolvedRecipientIds?.length ?? 0;
      if (audienceSize === 0) continue;
      const r = rng(ctx.state.demo.seed, 'channelViews', post.announcementId);
      const targetFraction = 0.5 + r() * 0.4; // 50-90% of reach eventually views a channel post
      const target = Math.round(audienceSize * targetFraction);
      const elapsedMinutes = Math.max(0, minutesBetween(post.at, ctx.now));
      const nextViews = Math.round(target * (1 - Math.exp(-elapsedMinutes / 6)));
      if (nextViews !== post.views) {
        post.views = nextViews;
        post.updatedAt = ctx.now;
        pending = true;
      }
    }

    const jobs: Job[] = pending
      ? [deliveryTickJob(addMillisecondsIso(ctx.now, rules.comms.delivery.tickBatchSeconds * 1000))]
      : [];

    return { ok: true, value: undefined, events: [], jobs } satisfies CommandResult<undefined>;
  },
});

defineCommand<'comms.releaseQuietHours'>({
  name: 'comms.releaseQuietHours',
  run: (ctx) => {
    const releasing = Object.values(ctx.state.deliveries).filter(
      (d) => d.state === 'held_quiet_hours',
    );
    for (const delivery of releasing) {
      const announcement = ctx.state.announcements[delivery.messageRef.id];
      const isUrgent = announcement?.type === 'urgent';
      const r = rng(
        ctx.state.demo.seed,
        'delivery',
        delivery.messageRef.id,
        delivery.recipientId,
        delivery.channel,
      );
      delivery.times = planDeliveryTimes(r, ctx.now, isUrgent, rules.comms.delivery);
      delivery.state = resolveDeliveryState(delivery.times, ctx.now);
      delivery.updatedAt = ctx.now;
      if (announcement && delivery.channel === 'wa_direct') {
        writeWaMessageForDelivery(ctx, announcement, delivery.recipientId, delivery.id);
      }
    }

    const jobs: Job[] =
      releasing.length > 0
        ? [
            deliveryTickJob(
              addMillisecondsIso(ctx.now, rules.comms.delivery.tickBatchSeconds * 1000),
            ),
          ]
        : [];

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs,
      audit: {
        action: 'comms.releaseQuietHours',
        target: { type: 'system', id: 'quietHours' },
        after: { released: releasing.length },
      },
    } satisfies CommandResult<undefined>;
  },
});
