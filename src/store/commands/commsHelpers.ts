/**
 * Shared helpers for the comms command handlers (announcements.ts,
 * amenityOps.ts, wa.ts): resolving an audience against live state,
 * sending an announcement (resolve → channels → precomputed delivery
 * plan), and keeping the global `delivery.tick` sweep alive.
 */
import { id } from '@/lib/ids';
import { rng } from '@/lib/random';
import { rules } from '@/config/rules';
import { addDaysIso, addMillisecondsIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { resolveAudience, type AudienceContext } from '@/domain/comms/audience';
import { isQuietHours, resolveChannelsForResident } from '@/domain/comms/fallback';
import { planDeliveryTimes } from '@/domain/comms/delivery';
import type { CommandCtx } from './types';
import type { Job } from '@/scheduler/queue';
import type { Announcement, Channel } from '@/types/comms';

export function buildAudienceContext(ctx: CommandCtx): AudienceContext {
  return {
    residents: ctx.state.residents,
    units: ctx.state.units,
    bookings: ctx.state.bookings,
    rsvps: ctx.state.rsvps,
    showtimes: ctx.state.showtimes,
    events: ctx.state.events,
    guardians: ctx.state.guardians,
  };
}

/** Stable, tick-unique job id — enqueue is idempotent by id, so each successive tick needs its own. */
export function deliveryTickJob(runAt: string): Job {
  return { id: `delivery-tick:${runAt}`, type: 'delivery.tick', runAt, payload: {} };
}

export function quietHoursReleaseJob(runAt: string): Job {
  return { id: `quietHours-release:${runAt}`, type: 'quietHours.release', runAt, payload: {} };
}

/** The next instant (today's, or tomorrow's if today's has already passed) a Dubai wall-clock `HH:mm` falls at or after `now`. */
export function nextDailyOccurrence(now: string, hhmm: string): string {
  const today = dubaiDateTimeToIso(dubaiDateKey(now), hhmm);
  if (today > now) return today;
  return dubaiDateTimeToIso(dubaiDateKey(addDaysIso(now, 1)), hhmm);
}

/** The next quiet-hours `end` instant (today's, or tomorrow's if today's has already passed). */
function nextQuietHoursEnd(now: string): string {
  return nextDailyOccurrence(now, rules.comms.quietHours.end);
}

/**
 * Resolves the audience, computes each recipient's channels and
 * precomputed delivery timing, and writes `Delivery`/`ChannelPost` rows.
 * Mutates `ctx.state` directly (always called from inside a command's own
 * `run()`), returning follow-up jobs for the caller to include in its own
 * `CommandResult.jobs`.
 */
export function sendAnnouncementNow(
  ctx: CommandCtx,
  announcement: Announcement,
  explicitRecipientIds?: Set<string>,
): Job[] {
  const recipients = explicitRecipientIds
    ? Object.values(ctx.state.residents).filter((r) => explicitRecipientIds.has(r.id))
    : resolveAudience(announcement.audience, buildAudienceContext(ctx));

  announcement.resolvedRecipientIds = recipients.map((r) => r.id);
  announcement.state = 'sent';
  announcement.sentAt = ctx.now;

  const personalChannels: Channel[] = announcement.channels.filter((c) => c !== 'wa_channel');
  const broadcastRequested = announcement.channels.includes('wa_channel');
  const isUrgent = announcement.type === 'urgent';
  const quiet = !isUrgent && isQuietHours(ctx.now, rules.comms.quietHours);

  let anyHeld = false;

  for (const resident of recipients) {
    const channels = resolveChannelsForResident(resident, personalChannels);

    if (channels.length === 0 && personalChannels.length > 0) {
      // Unreachable on any personal channel — recorded so the call-centre follow-up list can find them.
      const did = id('delivery');
      ctx.state.deliveries[did] = {
        id: did,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        messageRef: { type: 'announcement', id: announcement.id },
        recipientId: resident.id,
        channel: personalChannels[0] ?? 'app_inbox',
        state: 'skipped_opt_out',
        times: {},
      };
      continue;
    }

    for (const channel of channels) {
      const did = id('delivery');
      if (quiet) {
        ctx.state.deliveries[did] = {
          id: did,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          messageRef: { type: 'announcement', id: announcement.id },
          recipientId: resident.id,
          channel,
          state: 'held_quiet_hours',
          times: {},
        };
        anyHeld = true;
        continue;
      }
      const r = rng(ctx.state.demo.seed, 'delivery', announcement.id, resident.id, channel);
      const times = planDeliveryTimes(r, ctx.now, isUrgent, rules.comms.delivery);
      ctx.state.deliveries[did] = {
        id: did,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        messageRef: { type: 'announcement', id: announcement.id },
        recipientId: resident.id,
        channel,
        state: 'queued',
        times,
      };
      if (channel === 'wa_direct') {
        writeWaMessageForDelivery(ctx, announcement, resident.id, did);
      }
    }
  }

  if (broadcastRequested) {
    const postId = id('post');
    ctx.state.channelPosts[postId] = {
      id: postId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      announcementId: announcement.id,
      at: ctx.now,
      views: 0,
      reactions: {},
    };
  }

  const jobs: Job[] = [
    deliveryTickJob(addMillisecondsIso(ctx.now, rules.comms.delivery.tickBatchSeconds * 1000)),
  ];
  if (anyHeld) {
    jobs.push(quietHoursReleaseJob(nextQuietHoursEnd(ctx.now)));
  }
  return jobs;
}

/** A 1:1 WhatsApp bubble for an announcement's `wa_direct` delivery, linked by `deliveryId` so the Thread screen derives its ticks from the live `Delivery` state (PRD M16) instead of a static snapshot. */
export function writeWaMessageForDelivery(
  ctx: CommandCtx,
  announcement: Announcement,
  residentId: string,
  deliveryId: string,
): void {
  const waId = id('wa');
  const truncated =
    announcement.body.length > rules.comms.waCharacterLimit
      ? `${announcement.body.slice(0, rules.comms.waCharacterLimit - 24)}…\nRead more in the Amali App.`
      : announcement.body;
  ctx.state.waMessages[waId] = {
    id: waId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    threadResidentId: residentId,
    dir: 'out',
    at: ctx.now,
    kind: 'template',
    text: `${announcement.title}\n${truncated}`,
    deliveryId,
  };
}
