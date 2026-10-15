/** Quick action tile (PRD §5.7): white card, 28px bronze line icon, body-2 label. */
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
      className="rounded-card border-border-card bg-surface flex flex-col items-center gap-2 border-[0.5px] py-4 transition-transform active:scale-[0.97]"
    >
      <Icon className="text-brand h-7 w-7" strokeWidth={1.5} />
      <span className="text-body-2 text-text-body">{label}</span>
    </button>
  );
}
