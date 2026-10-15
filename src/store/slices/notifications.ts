/**
 * Notifications (TRD §9.6, PRD M13). `addNotification` is called directly
 * by features that need to notify a resident (wallet top-up, etc.) ahead of
 * the full event-bus → notifications subscriber pipeline (TRD §7.3), which
 * lands once enough domain events exist to justify it (P3+).
 */
import { id } from '@/lib/ids';
import type { Notification } from '@/types/comms';
import type { NotificationsState, StoreSlice } from '../types';

export interface NotificationInput {
  recipientId: string;
  at: string;
  title: string;
  body: string;
  deepLink: string;
  priority?: Notification['priority'];
}

export interface NotificationsActions {
  addNotification: (input: NotificationInput) => string;
  markNotificationRead: (notifId: string) => void;
}

export type NotificationsSlice = NotificationsState & NotificationsActions;

declare module '../types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface RootActions extends NotificationsActions {}
}

export const createNotificationsSlice: StoreSlice<NotificationsSlice> = (set) => ({
  notifications: {},

  addNotification: (input) => {
    const notifId = id('notif');
    set((s) => {
      s.notifications[notifId] = {
        id: notifId,
        createdAt: input.at,
        updatedAt: input.at,
        recipientId: input.recipientId,
        at: input.at,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        priority: input.priority ?? 'normal',
        read: false,
      };
    });
    return notifId;
  },

  markNotificationRead: (notifId) =>
    set((s) => {
      const n = s.notifications[notifId];
      if (n) n.read = true;
    }),
});
