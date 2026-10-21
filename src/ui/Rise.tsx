'use client';

/** Fades and lifts its children in, `i` steps (50 ms each, capped at 8) after the screen arrives. */
import { motion } from 'motion/react';
import { rise } from '@/design/motion';

export function Rise({
  i = 0,
  className,
  children,
}: {
  i?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      variants={rise}
      initial="initial"
      animate="animate"
      custom={i}
    >
      {children}
    </motion.div>
  );
}
