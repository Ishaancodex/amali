/**
 * Skeleton (PRD §5.7, M27): warm grey that breathes (no gradient). Shaped like the
 * final content — pass width/height to match what's loading.
 */
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-tile', className)} aria-hidden {...props} />;
}
