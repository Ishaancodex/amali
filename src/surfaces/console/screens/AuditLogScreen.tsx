'use client';

/**
 * The audit log viewer (PRD §8.8): every ops/comms/booking action, who,
 * when, what. Read-only — the log itself is written automatically by
 * `dispatch()` whenever a command carries an `audit` field.
 */
import { TopBar } from '@/ui/TopBar';
import { EmptyState } from '@/ui/EmptyState';
import { ClipboardCheck } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

export function AuditLogScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const { pop } = useNav(slot);
  const auditLog = useStore((s) => s.auditLog);
  const residents = useStore((s) => s.residents);
  const staff = useStore((s) => s.staff);

  const entries = [...auditLog].reverse().slice(0, 200);

  function actorName(entry: (typeof entries)[number]): string {
    if (entry.actor.kind === 'resident') return residents[entry.actor.id]?.name ?? entry.actor.id;
    if (entry.actor.kind === 'staff') return staff[entry.actor.id]?.name ?? entry.actor.id;
    return t('console.audit.system');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.audit.title')} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {entries.length === 0 ? (
            <EmptyState icon={ClipboardCheck} message={t('console.audit.empty')} />
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="border-border-card flex items-center gap-3 border-b py-2"
              >
                <span className="text-body-3 text-text-muted w-36 shrink-0">
                  {fmt.dateTime(entry.at)}
                </span>
                <span className="text-label-3 text-text-title w-32 shrink-0 truncate">
                  {actorName(entry)}
                </span>
                <span className="text-body-3 text-text-body flex-1 truncate">{entry.action}</span>
                <span className="text-body-3 text-text-placeholder shrink-0">
                  {entry.target.type}:{entry.target.id.slice(0, 10)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
