'use client';

/**
 * Wallet balance (PRD §8.4, M26): rolls via Odometer; a debit/credit flash
 * tints the chip briefly when the balance changes.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { fmtAed } from '@/lib/money';
import { Odometer } from '@/ui/Odometer';
import { dur } from '@/design/motion';

export function BalanceChip({ balanceFils }: { balanceFils: number }) {
  const prevRef = useRef(balanceFils);
  const [flash, setFlash] = useState<'credit' | 'debit' | null>(null);

  useEffect(() => {
    if (balanceFils !== prevRef.current) {
      setFlash(balanceFils > prevRef.current ? 'credit' : 'debit');
      prevRef.current = balanceFils;
      const t = setTimeout(() => setFlash(null), dur.slower * 1000);
      return () => clearTimeout(t);
    }
  }, [balanceFils]);

  return (
    <motion.div
      animate={{
        backgroundColor:
          flash === 'credit'
            ? 'color-mix(in srgb, var(--success) 10%, var(--brand-tint))'
            : flash === 'debit'
              ? 'color-mix(in srgb, var(--danger) 10%, var(--brand-tint))'
              : 'var(--brand-tint)',
      }}
      transition={{ duration: dur.slower }}
      className="rounded-tag inline-flex items-center gap-1.5 px-3 py-1.5"
    >
      <span className="text-label-3 text-brand">AED</span>
      <Odometer
        value={fmtAed(balanceFils).replace('AED', '').trim()}
        className="text-label-2 text-brand"
      />
    </motion.div>
  );
}
