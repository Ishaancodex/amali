/** Flat stand-in for a photo that failed to load: Ember with the subject's line icon (no gradient). */
import type { LucideIcon } from './icons';

export function PhotoFallback({
  icon: Icon,
  className = '',
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={`bg-ember-raised text-sand-soft flex h-full w-full items-center justify-center ${className}`}
    >
      <Icon className="h-9 w-9" strokeWidth={1.25} />
    </div>
  );
}
