/**
 * Top bar (PRD §5.7): back chevron, title (`title-l`), optional right icon.
 */
import { ChevronLeft } from './icons';
import type { LucideIcon } from './icons';

export function TopBar({
  title,
  onBack,
  rightIcon: RightIcon,
  onRightClick,
}: {
  title: string;
  onBack?: () => void;
  rightIcon?: LucideIcon;
  onRightClick?: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between px-4">
      <div className="flex w-10 items-center">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back" className="p-1">
            <ChevronLeft className="text-text-body h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>
      <h1 className="text-title-l text-text-title truncate">{title}</h1>
      <div className="flex w-10 items-center justify-end">
        {RightIcon && (
          <button type="button" onClick={onRightClick} aria-label="More" className="p-1">
            <RightIcon className="text-brand h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
