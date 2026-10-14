import { Menu } from 'lucide-react';

export function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Menu"
      aria-expanded={open}
      title="Scenario index & presenter tools"
      className="border-shell-stage-border bg-shell-stage-raised text-shell-stage-text hover:text-shell-stage-active flex h-9 w-9 items-center justify-center rounded-full border transition-colors active:scale-95"
    >
      <Menu className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
