/**
 * Notification acknowledgement (PRD §8.9 "Alerts inbox: emergency
 * closures with 'Acknowledge' — the time is logged"). A proper command
 * (not the lightweight `markNotificationRead` store action) specifically
 * so the acknowledgement lands in the audit log with its timestamp.
 */
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Notification } from '@/types/comms';

export interface NotificationAcknowledgeInput {
  notificationId: string;
}

declare module './types' {
  interface CommandRegistry {
    'notification.acknowledge': { input: NotificationAcknowledgeInput; output: Notification };
  }
}

defineCommand<'notification.acknowledge'>({
  name: 'notification.acknowledge',
  run: (ctx, input) => {
    const notification = ctx.state.notifications[input.notificationId];
    if (!notification) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Notification not found.' } };
    }
    notification.read = true;
    notification.updatedAt = ctx.now;

    return {
      ok: true,
      value: notification,
      events: [],
      jobs: [],
      audit: {
        action: 'notification.acknowledge',
        target: { type: 'notification', id: notification.id },
        after: { at: ctx.now },
      },
    } satisfies CommandResult<Notification>;
  },
});
