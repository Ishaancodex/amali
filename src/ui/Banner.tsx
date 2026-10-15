'use client';

/**
 * Home / amenity banner (PRD M14): height grows from 0, content fades in
 * after a short delay, content below shifts via layout animation.
 */
import { motion } from 'motion/react';
import { CircleAlert, Info, CheckCircle2, X } from './icons';
import { dur, ease } from '@/design/motion';
import { cn } from '@/lib/cn';

export type BannerStyle = 'info' | 'warning' | 'urgent' | 'success';

export interface BannerProps {
  style?: BannerStyle;
  children: React.ReactNode;
  onDismiss?: () => void;
  cta?: { label: string; onClick: () => void };
}

const STYLE_CLASSES: Record<BannerStyle, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  urgent: 'bg-danger/10 text-danger',
  success: 'bg-success/10 text-success',
};

const STYLE_ICON = {
  info: Info,
  warning: CircleAlert,
  urgent: CircleAlert,
  success: CheckCircle2,
} as const;

export function Banner({ style = 'info', children, onDismiss, cta }: BannerProps) {
  const Icon = STYLE_ICON[style];
  return (
    <motion.div
      layout
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: dur.base, ease: ease.enter }}
      className="overflow-hidden"
    >
      <div className={cn('flex items-start gap-2.5 px-4 py-3', STYLE_CLASSES[style])}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
        <div className="text-body-2 flex-1">{children}</div>
        {cta && (
          <button type="button" onClick={cta.onClick} className="text-label-3 shrink-0 underline">
            {cta.label}
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
