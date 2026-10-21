/** Tracked-caps label (Julius Sans One, `eyebrow` type token). Caps and tracking drop in Arabic. */
import { cn } from '@/lib/cn';

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('font-wide text-eyebrow text-text-muted', className)}>{children}</span>
  );
}
