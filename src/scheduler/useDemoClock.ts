'use client';

/**
 * React hook over the demo clock (TRD §7.4, §16.4, §8.2). In 'live' mode it
 * advances `demo.clock.now` on every animation frame, scaled by
 * `demo.clock.speed`, and runs due jobs on every change. Only the leader
 * tab ticks the live loop or runs jobs — followers just display whatever
 * clock value `store/sync.ts` mirrors in, so jobs never run twice across
 * tabs.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { useIsLeader } from '@/store/sync';
import { tickLive, type ClockJump } from './clock';
import { runDueAndSync } from './runDueAndSync';

export function useDemoClock() {
  const now = useStore((s) => s.demo.clock.now);
  const mode = useStore((s) => s.demo.clock.mode);
  const speed = useStore((s) => s.demo.clock.speed);
  const setClockNow = useStore((s) => s.setClockNow);
  const jumpClockAction = useStore((s) => s.jumpClock);
  const setClockMode = useStore((s) => s.setClockMode);
  const setClockSpeed = useStore((s) => s.setClockSpeed);
  const isLeader = useIsLeader();

  const lastFrameRef = useRef<number | null>(null);

  // On load (or on taking over as leader) run anything already due — restored jobs whose time
  // passed while the page was closed, with the clock paused, would otherwise wait for a tick.
  useEffect(() => {
    if (isLeader) runDueAndSync(useStore.getState().demo.clock.now);
  }, [isLeader]);

  useEffect(() => {
    if (mode !== 'live' || !isLeader) {
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
        runDueAndSync(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, speed, setClockNow, isLeader]);

  function jump(j: ClockJump) {
    jumpClockAction(j);
    if (isLeader) runDueAndSync(useStore.getState().demo.clock.now);
  }

  function setNow(iso: string) {
    setClockNow(iso);
    if (isLeader) runDueAndSync(iso);
  }

  return { now, mode, speed, isLeader, jump, setNow, setClockMode, setClockSpeed };
}
