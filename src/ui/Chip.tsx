import { cn } from '@/lib/cn';

/** Selectable pill: Ember when chosen, a hairline ring otherwise. */
export function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-label-3 rounded-full px-4 py-2 transition-colors disabled:line-through disabled:opacity-40',
        active ? 'bg-ember text-on-ember' : 'border-border-card text-text-body border',
      )}
    >
      {children}
    </button>
  );
}
