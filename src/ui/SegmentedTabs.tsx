'use client';

/** Pill segmented control: a Pearl-3 track with a sliding ink pill under the active tab. */
import { useId } from 'react';
import { motion } from 'motion/react';
import { dur, ease } from '@/design/motion';

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  const group = useId();
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-border-card/60 flex gap-0.5 rounded-full p-1"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`font-wide text-eyebrow relative h-9 flex-1 rounded-full px-3 transition-colors ${active ? 'text-on-ember' : 'text-text-muted'}`}
          >
            {active && (
              <motion.span
                layoutId={`${group}:pill`}
                className="bg-ember absolute inset-0 rounded-full"
                transition={{ duration: dur.base, ease: ease.soft }}
              />
            )}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
