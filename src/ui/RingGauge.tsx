'use client';

/**
 * Occupancy ring (PRD M17). The arc animates between values; colour tweens
 * when the band changes.
 */
import { motion } from 'motion/react';
import { spring } from '@/design/motion';
import type { OccupancyBand } from '@/types/ops';

export type { OccupancyBand };

const BAND_COLOR: Record<OccupancyBand, string> = {
  quiet: 'var(--success)',
  moderate: 'var(--warning)',
  busy: 'var(--danger)',
};

export function RingGauge({
  fraction,
  band,
  size = 72,
  strokeWidth = 7,
  children,
}: {
  fraction: number;
  band: OccupancyBand;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-card)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{
            strokeDashoffset: circumference * (1 - clamped),
            stroke: BAND_COLOR[band],
          }}
          transition={spring.soft}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
