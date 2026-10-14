/**
 * The demo slice (TRD §5.9, §16.4). Owns the clock, device sessions, dual
 * view and presenter settings. `scheduler/useDemoClock.ts` reads/writes
 * `demo.clock` through the actions here.
 */
import type { DeviceSession, Role, ConsoleRole, ClockSpeed, MotionSpeed, DemoState } from '@/types/demo';
import { applyJump, type ClockJump } from '@/scheduler/clock';
import { PERSONA_IDS } from '@/seed/personaIds';
import type { DemoSliceState, StoreSlice } from '../types';

// PRD §15 S1 — "Start: Wed 14 Oct, 17:30" → 13:30 UTC (Dubai is UTC+4, no DST).
export const DEMO_START_ISO = '2026-10-14T13:30:00.000Z';
export const SEED_NAME = 'amali-2026';
export const STATE_VERSION = 1;

function defaultDeviceA(): DeviceSession {
  return {
    slot: 'A',
    role: 'resident',
    actorId: PERSONA_IDS.layla,
    locale: 'en',
    nav: { stack: [] },
    offline: false,
  };
}

/** Shared by this slice's initial state and `seed/index.ts#buildSeed`, so they never drift. */
export function defaultDemoState(now: string = DEMO_START_ISO, seed: string = SEED_NAME): DemoState {
  return {
    clock: { now, mode: 'paused', speed: 1 },
    motionSpeed: 1,
    dualView: false,
    devices: { A: defaultDeviceA() },
    tickerOn: false,
    simulatedLatencyMs: [300, 600],
    seed,
    version: STATE_VERSION,
  };
}

export interface DemoActions {
  setClockNow: (iso: string) => void;
  jumpClock: (jump: ClockJump) => void;
  setClockSpeed: (speed: ClockSpeed) => void;
  setClockMode: (mode: 'live' | 'paused') => void;
  setMotionSpeed: (speed: MotionSpeed) => void;
  setDualView: (on: boolean) => void;
  toggleTicker: () => void;
  setRole: (slot: 'A' | 'B', role: Role, actorId: string) => void;
  setPersona: (slot: 'A' | 'B', actorId: string) => void;
  setConsoleRole: (slot: 'A' | 'B', consoleRole: ConsoleRole) => void;
  setDeviceOffline: (slot: 'A' | 'B', offline: boolean) => void;
  setScenario: (id: string, step: number) => void;
  clearScenario: () => void;
}

export type DemoSlice = DemoSliceState & DemoActions;

// Merge this slice's actions into the root store type (store/types.ts).
declare module '../types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface RootActions extends DemoActions {}
}

export const createDemoSlice: StoreSlice<DemoSlice> = (set) => ({
  demo: defaultDemoState(),

  setClockNow: (iso) =>
    set((s) => {
      s.demo.clock.now = iso;
    }),

  jumpClock: (jump) =>
    set((s) => {
      s.demo.clock.now = applyJump(s.demo.clock.now, jump);
    }),

  setClockSpeed: (speed) =>
    set((s) => {
      s.demo.clock.speed = speed;
    }),

  setClockMode: (mode) =>
    set((s) => {
      s.demo.clock.mode = mode;
    }),

  setMotionSpeed: (speed) =>
    set((s) => {
      s.demo.motionSpeed = speed;
    }),

  setDualView: (on) =>
    set((s) => {
      s.demo.dualView = on;
      if (on && !s.demo.devices.B) {
        s.demo.devices.B = {
          slot: 'B',
          role: 'guard',
          actorId: '',
          locale: 'en',
          nav: { stack: [] },
          offline: false,
        };
      }
    }),

  toggleTicker: () =>
    set((s) => {
      s.demo.tickerOn = !s.demo.tickerOn;
    }),

  setRole: (slot, role, actorId) =>
    set((s) => {
      const device = s.demo.devices[slot];
      if (device) {
        device.role = role;
        device.actorId = actorId;
        device.nav.stack = [];
      } else if (slot === 'B') {
        s.demo.devices.B = {
          slot: 'B',
          role,
          actorId,
          locale: 'en',
          nav: { stack: [] },
          offline: false,
        };
      }
    }),

  setPersona: (slot, actorId) =>
    set((s) => {
      const device = s.demo.devices[slot];
      if (device) device.actorId = actorId;
    }),

  setConsoleRole: (slot, consoleRole) =>
    set((s) => {
      const device = s.demo.devices[slot];
      if (device) device.consoleRole = consoleRole;
    }),

  setDeviceOffline: (slot, offline) =>
    set((s) => {
      const device = s.demo.devices[slot];
      if (device) device.offline = offline;
    }),

  setScenario: (id, step) =>
    set((s) => {
      s.demo.scenario = { id, step };
    }),

  clearScenario: () =>
    set((s) => {
      s.demo.scenario = undefined;
    }),
});
