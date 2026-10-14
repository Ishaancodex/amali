'use client';

/**
 * The live event ticker (PRD §4.1): optional, off by default. A thin feed
 * in the bottom-left listing system events as they happen, to prove
 * things are live.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '@/store';
import { eventBus, type DomainEvent } from '@/store/eventBus';
import { fmtTime } from '@/lib/time';
import { dur, ease } from '@/design/motion';

const MAX_ENTRIES = 6;

function describe(event: DomainEvent): string {
  switch (event.type) {
    case 'demo.clockJumped':
      return `Clock jumped to ${fmtTime(event.to)}`;
    case 'demo.scenarioChanged':
      return event.scenarioId
        ? `Scenario set to ${event.scenarioId}, step ${(event.step ?? 0) + 1}`
        : 'Scenario cleared';
  }
}

interface TickerEntry {
  id: string;
  at: string;
  text: string;
}

export function EventTicker() {
  const on = useStore((s) => s.demo.tickerOn);
  const [entries, setEntries] = useState<TickerEntry[]>([]);

  useEffect(() => {
    if (!on) return;
    let n = 0;
    const unsubscribers = (['demo.clockJumped', 'demo.scenarioChanged'] as const).map((type) =>
      eventBus.on(type, (event) => {
        n += 1;
        setEntries((prev) =>
          [{ id: `${type}-${n}`, at: event.at, text: describe(event) }, ...prev].slice(
            0,
            MAX_ENTRIES,
          ),
        );
      }),
    );
    return () => unsubscribers.forEach((u) => u());
  }, [on]);

  if (!on) return null;

  return (
    <div className="pointer-events-none fixed start-4 bottom-4 z-20 flex w-80 flex-col gap-1">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast, ease: ease.enter }}
            className="rounded-input border-shell-stage-border bg-shell-stage-raised text-body-3 text-shell-stage-text border px-3 py-1.5"
          >
            <span className="text-shell-notes-label tabular-nums">{fmtTime(entry.at)}</span>{' '}
            {entry.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
