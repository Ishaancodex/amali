/**
 * Status tag (PRD §5.7): pill, brand-tint fill by default, `tag` text
 * style. Colour is never the only signal — pair with an icon where the
 * status matters (PRD §5.2).
 */
import { cn } from '@/lib/cn';
import type { LucideIcon } from './icons';

export type TagVariant = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'maintenance';

export interface TagProps {
  variant?: TagVariant;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<TagVariant, string> = {
  brand: 'bg-brand-tint text-brand',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  maintenance: 'bg-maintenance/15 text-maintenance',
};

export function Tag({ variant = 'brand', icon: Icon, children, className }: TagProps) {
  return (
    <span
      className={cn(
        'rounded-tag text-tag inline-flex items-center gap-1 px-2.5 py-1 tracking-wide uppercase',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={1.5} />}
      {children}
    </span>
  );
}
