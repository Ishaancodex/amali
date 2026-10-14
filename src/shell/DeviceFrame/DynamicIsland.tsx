'use client';

/**
 * The dynamic-island slot (PRD §4.2, M13). In Phase P1 this just renders the
 * resting pill shape; `features/notifications/IslandNotification` mounts
 * here from Phase P2 onward to expand it for incoming notifications.
 */
import { motion } from 'motion/react';
import { spring } from '@/design/motion';

export function DynamicIsland({ children }: { children?: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
      <motion.div
        layout
        transition={spring.snappy}
        className="pointer-events-auto flex min-h-[32px] min-w-[126px] items-center justify-center rounded-full bg-black"
      >
        {children}
      </motion.div>
    </div>
  );
}
