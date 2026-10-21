/** History: daily checklist runs, past announcements with deliveries, resolved work orders. */
import { rngInt, rngPick, type Rng } from '@/lib/random';
import { rules } from '@/config/rules';
import { addMinutesIso, dubaiDateTimeToIso } from '@/lib/time';
import { computeSlaDeadlines } from '@/domain/ops/sla';
import type { AppState } from '@/store/types';
import { ANNOUNCEMENT_AUDIENCE } from './shared';

export function checklistDay(state: AppState, dateKey: string, d: number) {
  // ~93% of daily checklists completed (a missed one every couple of weeks per template).
  for (const t of Object.values(state.checklistTemplates)) {
    if ((d + t.id.length) % 15 === 0) continue;
    const id = `checklist_hist_${t.id}_${d}`;
    const at = dubaiDateTimeToIso(dateKey, '08:00');
    state.checklistRuns[id] = {
      id,
      createdAt: at,
      updatedAt: at,
      templateId: t.id,
      date: dateKey,
      by: 'staff_victor',
      completedAt: at,
      items: [],
    };
  }
}

export function announcementDay(
  state: AppState,
  r: Rng,
  dateKey: string,
  d: number,
  residentIds: string[],
) {
  const sentAt = dubaiDateTimeToIso(dateKey, '07:30');
  const id = `ann_hist_${d}`;
  const recipients = residentIds
    .slice((d * 7) % residentIds.length)
    .concat(residentIds)
    .slice(0, ANNOUNCEMENT_AUDIENCE);
  state.announcements[id] = {
    id,
    createdAt: sentAt,
    updatedAt: sentAt,
    type: 'daily',
    title: 'Today at Amali',
    body: 'Your daily amenities update.',
    amenityTags: [],
    audience: { include: [{ kind: 'all' }], exclude: [] },
    channels: ['app_push', 'wa_direct'],
    schedule: { mode: 'now' },
    state: 'sent',
    sentAt,
    resolvedRecipientIds: recipients,
    createdBy: 'staff_hana',
  };
  recipients.forEach((rid, i) => {
    const delivered = r() < 0.96;
    const read = delivered && r() < 0.78;
    const deliveredAt = addMinutesIso(sentAt, rngInt(r, 1, 4));
    state.deliveries[`delivery_hist_${d}_${i}`] = {
      id: `delivery_hist_${d}_${i}`,
      createdAt: sentAt,
      updatedAt: sentAt,
      messageRef: { type: 'announcement', id },
      recipientId: rid,
      channel: i % 3 === 0 ? 'wa_direct' : 'app_push',
      state: read ? 'read' : delivered ? 'delivered' : 'failed',
      times: {
        queued: sentAt,
        sent: sentAt,
        ...(delivered ? { delivered: deliveredAt } : { failed: deliveredAt }),
        ...(read ? { read: addMinutesIso(deliveredAt, rngInt(r, 2, 180)) } : {}),
      },
    };
  });
}

export function workOrderDay(state: AppState, r: Rng, dateKey: string, d: number) {
  const createdAt = dubaiDateTimeToIso(dateKey, '09:00');
  const priority = rngPick(r, ['P2', 'P3', 'P3'] as const);
  const deadlines = computeSlaDeadlines(priority, createdAt, rules.ops);
  // ~86% resolved inside the SLA; the rest land up to a day past the resolve-by.
  const resolvedAt =
    r() < 0.86
      ? addMinutesIso(createdAt, rngInt(r, 60, 600))
      : addMinutesIso(deadlines.resolveBy, rngInt(r, 60, 1440));
  const id = `wo_hist_${d}`;
  state.workOrders[id] = {
    id,
    createdAt,
    updatedAt: resolvedAt,
    amenity: rngPick(r, ['pool', 'gym', 'padel'] as const),
    title: rngPick(r, [
      'Replace lane rope',
      'Treadmill belt slipping',
      'Court light flickering',
      'Shower drain slow',
    ]),
    priority,
    assignee: { kind: 'staff', id: 'staff_ravi' },
    state: 'closed',
    sla: { ...deadlines, pausedMs: 0, respondedAt: addMinutesIso(createdAt, 30), resolvedAt },
    timeline: [{ at: createdAt, by: 'staff_victor', type: 'created' }],
    resolution: { note: 'Fixed.' },
  };
}
