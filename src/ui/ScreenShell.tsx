'use client';

/**
 * The resident page frame: an Ember `HeaderBand` (optionally over a photo) with a Pearl `BodySheet`
 * sliding up over its lower edge. `footer` is pinned under the scroll area (sticky CTAs).
 * Every resident screen is built on this so they all share one header, one scroll container and
 * one place for the arrival animation.
 */
import { HeaderBand } from './HeaderBand';
import { BodySheet } from './BodySheet';

export function ScreenShell({
  eyebrow,
  title,
  onBack,
  right,
  image,
  imageLayoutId,
  imageKenBurns,
  tall,
  headerExtra,
  footer,
  bodyClassName,
  children,
}: {
  eyebrow?: string;
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  image?: string;
  imageLayoutId?: string;
  imageKenBurns?: boolean;
  tall?: boolean;
  /** Extra header content under the title (a balance, a child's name…). */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Focusable so the page can be scrolled from the keyboard (axe scrollable-region-focusable). */}
      <div className="min-h-0 flex-1 overflow-y-auto outline-none" tabIndex={0}>
        <HeaderBand
          eyebrow={eyebrow}
          title={title}
          onBack={onBack}
          right={right}
          image={image}
          imageLayoutId={imageLayoutId}
          imageKenBurns={imageKenBurns}
          tall={tall}
        >
          {headerExtra}
        </HeaderBand>
        <BodySheet className={bodyClassName}>{children}</BodySheet>
      </div>
      {footer}
    </div>
  );
}
