/**
 * Resident SOS (hold-to-confirm on Home). Raises a high-priority notification for the guards and
 * the community manager, so the Guard device's alert list (and the Console's ops alerts) react
 * live. Prototype only — nothing leaves the app. The alert text stays English (stored data).
 */
import { id } from '@/lib/ids';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { StaffRole } from '@/types/community';

export type SosKind = 'security' | 'medical' | 'fire';

export interface SosRaiseInput {
  kind: SosKind;
}

declare module './types' {
  interface CommandRegistry {
    'sos.raise': { input: SosRaiseInput; output: { notified: number } };
  }
}

const RECIPIENT_ROLES: ReadonlySet<StaffRole> = new Set(['guard', 'community_manager']);

const TITLE: Record<SosKind, string> = {
  security: 'SOS — Security',
  medical: 'SOS — Medical',
  fire: 'SOS — Fire',
};

defineCommand<'sos.raise'>({
  name: 'sos.raise',
  run: (ctx, input) => {
    const resident = ctx.state.residents[ctx.actor.id];
    if (!resident) {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'Only a resident can raise an SOS.' },
      };
    }
    let notified = 0;
    for (const staff of Object.values(ctx.state.staff)) {
      if (!RECIPIENT_ROLES.has(staff.role)) continue;
      const notifId = id('notif');
      ctx.state.notifications[notifId] = {
        id: notifId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        recipientId: staff.id,
        at: ctx.now,
        title: TITLE[input.kind],
        body: `${resident.name} · unit ${resident.unitId} needs help now.`,
        deepLink: 'amali://guard/home',
        priority: 'high',
        read: false,
      };
      notified += 1;
    }
    return {
      ok: true,
      value: { notified },
      events: [],
      jobs: [],
      audit: {
        action: 'sos.raise',
        target: { type: 'resident', id: resident.id },
        after: { kind: input.kind, notified },
      },
    } satisfies CommandResult<{ notified: number }>;
  },
});
