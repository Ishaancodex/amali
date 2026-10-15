'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, CircleAlert } from './icons';
import { dur, ease } from '@/design/motion';

export interface ToastProps {
  message: string;
  variant?: 'success' | 'error' | 'neutral';
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, variant = 'neutral', onDismiss, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: dur.fast, ease: ease.enter }}
      className="rounded-card bg-shell-stage text-body-2 text-shell-stage-active pointer-events-auto flex items-center gap-2 px-4 py-3 shadow-xl"
      role="status"
    >
      {variant === 'success' && <CheckCircle2 className="text-success h-4 w-4" strokeWidth={1.5} />}
      {variant === 'error' && <CircleAlert className="text-danger h-4 w-4" strokeWidth={1.5} />}
      {message}
    </motion.div>
  );
}
