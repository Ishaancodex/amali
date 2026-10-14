'use client';

/**
 * Scales a device frame to fit the available space (PRD §4.1: "Frames
 * scale to fit the viewport height minus 160px, centred"). Also caps by
 * available width, so dual view (two frames side by side) and narrow
 * windows degrade gracefully rather than overflowing.
 */
import { useEffect, useRef, useState } from 'react';

export interface DeviceScaleOptions {
  frameWidth: number;
  frameHeight: number;
  /** Vertical chrome to reserve outside the frame (top bar, padding) — PRD's 160px default. */
  reserveHeight?: number;
  /** Never scale above this (frames render at their logical size at most). */
  maxScale?: number;
}

export function useDeviceScale({
  frameWidth,
  frameHeight,
  reserveHeight = 160,
  maxScale = 1,
}: DeviceScaleOptions): { scale: number; containerRef: React.RefObject<HTMLDivElement | null> } {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    function recompute() {
      const availableWidth = el?.clientWidth ?? frameWidth;
      const availableHeight = Math.max(window.innerHeight - reserveHeight, 200);
      const byWidth = availableWidth / frameWidth;
      const byHeight = availableHeight / frameHeight;
      setScale(Math.min(maxScale, byWidth, byHeight));
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [frameWidth, frameHeight, reserveHeight, maxScale]);

  return { scale, containerRef };
}
