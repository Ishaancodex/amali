/**
 * Wallet ledger (PRD §8.4): top-up, charge, hold, hold release, refund,
 * fee, forfeit. Holds show as "On hold" and don't count toward balance.
 */
import { ArrowDownCircle, ArrowUpCircle, Wallet as WalletIcon } from '@/ui/icons';
import { EmptyState } from '@/ui/EmptyState';
import { useFmt, useT } from '@/i18n/hooks';
import type { LedgerEntry } from '@/types/wallet';

const CREDIT_KINDS = new Set<LedgerEntry['kind']>(['topup', 'refund', 'hold_release']);

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const t = useT();
  const fmt = useFmt();
  const kindLabel = (kind: LedgerEntry['kind']) => t(`wallet.kind.${kind}`);
  if (entries.length === 0) {
    return <EmptyState icon={WalletIcon} message={t('wallet.empty')} />;
  }

  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ul className="divide-border-card divide-y">
      {sorted.map((entry) => {
        const isCredit = CREDIT_KINDS.has(entry.kind);
        return (
          <li key={entry.id} className="flex items-center gap-3 py-3">
            {isCredit ? (
              <ArrowDownCircle className="text-success h-5 w-5 shrink-0" strokeWidth={1.5} />
            ) : (
              <ArrowUpCircle className="text-text-muted h-5 w-5 shrink-0" strokeWidth={1.5} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-label-2 text-text-body truncate">
                {entry.label || kindLabel(entry.kind)}
              </p>
              <p className="text-body-3 text-text-muted">
                {fmt.dateTime(entry.at)}
                {entry.kind === 'hold' ? ` · ${kindLabel('hold')}` : ''}
              </p>
            </div>
            <span
              className={`text-label-2 tabular-nums ${isCredit ? 'text-success' : 'text-text-body'}`}
            >
              {isCredit ? '+' : '−'}
              {/* Charges are stored negative — show the magnitude next to the sign. */}
              {fmt.aed(Math.abs(entry.fils))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
