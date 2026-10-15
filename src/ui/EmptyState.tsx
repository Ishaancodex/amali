/**
 * Empty state (PRD §12): a line illustration in bronze, one sentence, one action.
 */
import type { LucideIcon } from './icons';
import { Button } from './Button';

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <Icon className="text-brand h-10 w-10" strokeWidth={1.5} />
      <p className="text-body-2 text-text-muted">{message}</p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
