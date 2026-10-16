'use client';

/**
 * The 1:1 business thread (PRD §8.7): quick-reply buttons run their
 * embedded command on tap, and ticks (M16: single → double → bronze
 * double) are derived live from the linked `Delivery` row when one
 * exists, rather than a static snapshot.
 */
import { TopBar } from '@/ui/TopBar';
import { Check, CheckCheck } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { fmtTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import type { Delivery, WaMessage } from '@/types/comms';
import type { CommandName } from '@/store/commands/types';

function TickIcon({ message, delivery }: { message: WaMessage; delivery?: Delivery }) {
  const resolved = delivery ? delivery.state : (message.ticks ?? 'sent');
  if (
    resolved === 'failed' ||
    resolved === 'skipped_opt_out' ||
    resolved === 'held_quiet_hours' ||
    resolved === 'queued'
  ) {
    return <Check className="text-shell-notes-body h-3.5 w-3.5" strokeWidth={1.5} />;
  }
  if (resolved === 'read') {
    return <CheckCheck className="text-brand h-3.5 w-3.5" strokeWidth={1.5} />;
  }
  // 'sent' or 'delivered'
  return <CheckCheck className="text-shell-notes-body h-3.5 w-3.5" strokeWidth={1.5} />;
}

export function ThreadScreen({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const waMessages = useStore((s) => s.waMessages);
  const deliveries = useStore((s) => s.deliveries);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const { pop } = useNav(slot);

  const messages = Object.values(waMessages)
    .filter((m) => m.threadResidentId === actorId)
    .sort((a, b) => a.at.localeCompare(b.at));

  function handleQuickReply(message: WaMessage, buttonId: string) {
    const button = message.buttons?.find((b) => b.id === buttonId);
    if (!button) return;
    const recorded = dispatch(
      'wa.recordReply',
      { waMessageId: message.id, buttonId },
      { kind: 'resident', id: actorId },
    );
    if (!recorded.ok) {
      pushToast(slot, recorded.error.message, 'error');
      return;
    }
    const result = dispatch(button.action.name as CommandName, button.action.args as never, {
      kind: 'resident',
      id: actorId,
    });
    pushToast(slot, result.ok ? 'Done.' : result.error.message, result.ok ? 'success' : 'error');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Amali Residences" onBack={pop} />
      <div className="flex flex-1 flex-col-reverse gap-2 overflow-y-auto px-4 py-4">
        <div />
        {[...messages].reverse().map((m) => {
          const delivery = m.deliveryId ? deliveries[m.deliveryId] : undefined;
          const isOut = m.dir === 'out';
          return (
            <div key={m.id} className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 whitespace-pre-line ${
                  isOut
                    ? 'bg-brand-tint text-text-body'
                    : 'bg-surface border-border-card text-text-body border-[0.5px]'
                }`}
              >
                <p className="text-body-2">{m.text}</p>
                {m.buttons && m.buttons.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-black/10 pt-2">
                    {m.buttons.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!!m.answeredButtonId}
                        onClick={() => handleQuickReply(m, b.id)}
                        className={`text-label-3 rounded-full py-1.5 text-center ${
                          m.answeredButtonId === b.id
                            ? 'bg-brand text-on-brand'
                            : m.answeredButtonId
                              ? 'text-text-placeholder'
                              : 'text-brand bg-surface'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className="text-body-3 text-text-muted">{fmtTime(m.at)}</span>
                  {isOut && <TickIcon message={m} delivery={delivery} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
