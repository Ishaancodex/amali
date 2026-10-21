'use client';

/**
 * Rule rejection (PRD M10): the offending control shakes once (x: 0, −6, 6,
 * −4, 4, 0) each time `trigger` changes — pass the error message.
 */
import { motion } from 'motion/react';
import { shake } from '@/design/motion';

export function Shake({ trigger, children }: { trigger: string; children: React.ReactNode }) {
  return (
    <motion.div key={trigger} variants={shake} initial="rest" animate="shake">
      {children}
    </motion.div>
  );
}
