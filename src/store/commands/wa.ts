/**
 * WhatsApp thread commands (PRD §8.7 "Two-way replies work"). The quick-
 * reply button's own action (e.g. `waitlist.accept`) is dispatched
 * separately by the Thread screen — this command only records the tap as
 * an inbound message and freezes the original message's buttons so they
 * can't be tapped twice.
 */
import { id } from '@/lib/ids';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { WaMessage } from '@/types/comms';

export interface WaRecordReplyInput {
  waMessageId: string;
  buttonId: string;
}

declare module './types' {
  interface CommandRegistry {
    'wa.recordReply': { input: WaRecordReplyInput; output: WaMessage };
  }
}

defineCommand<'wa.recordReply'>({
  name: 'wa.recordReply',
  run: (ctx, input) => {
    const message = ctx.state.waMessages[input.waMessageId];
    if (!message || message.answeredButtonId) {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This message has already been answered.' },
      };
    }
    const button = message.buttons?.find((b) => b.id === input.buttonId);
    if (!button) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Button not found.' } };
    }

    message.answeredButtonId = input.buttonId;
    message.updatedAt = ctx.now;

    const replyId = id('wa');
    const reply: WaMessage = {
      id: replyId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      threadResidentId: message.threadResidentId,
      dir: 'in',
      at: ctx.now,
      kind: 'quick_reply_answer',
      text: button.label,
      ticks: 'read',
    };
    ctx.state.waMessages[replyId] = reply;

    return {
      ok: true,
      value: reply,
      events: [],
      jobs: [],
      audit: {
        action: 'wa.recordReply',
        target: { type: 'waMessage', id: message.id },
        after: { buttonId: input.buttonId },
      },
    } satisfies CommandResult<WaMessage>;
  },
});
