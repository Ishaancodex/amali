/**
 * Demo and devices (TRD §5.9).
 */

export type Role = 'resident' | 'whatsapp' | 'guard' | 'creche' | 'fnb' | 'console';
export type ConsoleRole = 'community_manager' | 'amenity_supervisor' | 'call_centre';
export type DeviceSlotId = 'A' | 'B';

export interface NavStackEntry {
  route: string;
  params: Record<string, string>;
}

export interface DeviceSession {
  slot: DeviceSlotId;
  role: Role;
  actorId: string; // resident id or staff id
  consoleRole?: ConsoleRole;
  locale: 'en' | 'ar';
  nav: { stack: NavStackEntry[] };
  offline: boolean;
}

export type ClockMode = 'live' | 'paused';
export type ClockSpeed = 1 | 2 | 5 | 10;
export type MotionSpeed = 0 | 0.5 | 1;

export interface DemoClockState {
  now: string; // ISODateTime
  mode: ClockMode;
  speed: ClockSpeed;
}

export interface DemoState {
  clock: DemoClockState;
  motionSpeed: MotionSpeed;
  dualView: boolean;
  devices: { A: DeviceSession; B?: DeviceSession };
  scenario?: { id: string; step: number };
  tickerOn: boolean;
  simulatedLatencyMs: [number, number];
  seed: string;
  version: number;
}
