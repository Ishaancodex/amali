/** Quick action tile: Pearl card, hairline ring, brand line icon, tracked-caps label. */
import type { LucideIcon } from './icons';

export function QuickActionTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-tile border-border-card bg-surface flex aspect-[1/0.92] flex-col items-start justify-between border-[0.5px] p-3.5 text-start transition-transform active:scale-[0.97]"
    >
      <Icon className="text-brand h-6 w-6" strokeWidth={1.25} />
      <span className="font-wide text-eyebrow text-text-title">{label}</span>
    </button>
  );
}
