/**
 * Top bar (PRD §5.7): back chevron, title (`title-l`), optional right icon.
 * Title is start-aligned, immediately after the back chevron when present
 * (layout reference: Figma's "Amenities"/"My Unit"/"Profile" frames all
 * left-align the page title rather than centering it in the bar).
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
    <div className="flex h-14 shrink-0 items-center gap-1 px-4">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back" className="-ms-1 shrink-0 p-1">
          <ChevronLeft className="text-text-body h-5 w-5" strokeWidth={1.5} />
        </button>
      )}
      <h1 className="text-title-l text-text-title min-w-0 flex-1 truncate text-start">{title}</h1>
      {RightIcon && (
        <button type="button" onClick={onRightClick} aria-label="More" className="shrink-0 p-1">
          <RightIcon className="text-brand h-5 w-5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
