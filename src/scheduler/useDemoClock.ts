'use client';

/**
 * React hook over the demo clock (TRD §7.4, §16.4). In 'live' mode it
 * advances `demo.clock.now` on every animation frame, scaled by
 * `demo.clock.speed`, and runs due jobs on every change. Only the leader
 * tab should actually tick (TRD §8.2) — that gating is added in Phase P1
 * once BroadcastChannel sync exists; for now every tab ticks its own clock.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { tickLive, type ClockJump } from './clock';
import { schedulerEngine } from './engine';

export function useDemoClock() {
  const now = useStore((s) => s.demo.clock.now);
  const mode = useStore((s) => s.demo.clock.mode);
  const speed = useStore((s) => s.demo.clock.speed);
  const setClockNow = useStore((s) => s.setClockNow);
  const jumpClockAction = useStore((s) => s.jumpClock);
  const setClockMode = useStore((s) => s.setClockMode);
  const setClockSpeed = useStore((s) => s.setClockSpeed);

  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== 'live') {
      lastFrameRef.current = null;
      return;
    }

    let raf = 0;
    const tick = (frameTime: number) => {
      const last = lastFrameRef.current;
      lastFrameRef.current = frameTime;
      if (last !== null) {
        const elapsedMs = frameTime - last;
        const next = tickLive(useStore.getState().demo.clock.now, elapsedMs, speed);
        setClockNow(next);
        schedulerEngine.runDue(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, speed, setClockNow]);

  function jump(j: ClockJump) {
    jumpClockAction(j);
    schedulerEngine.runDue(useStore.getState().demo.clock.now);
  }

  function setNow(iso: string) {
    setClockNow(iso);
    schedulerEngine.runDue(iso);
  }

  return { now, mode, speed, jump, setNow, setClockMode, setClockSpeed };
}
