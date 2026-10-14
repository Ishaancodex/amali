/**
 * Multi-tab sync (TRD §8.2). Lets the presenter put the Guard app on a
 * second screen (`/present?role=guard`) and see it mirror the main tab,
 * both ways.
 *
 * **Deviation from TRD §8.2:** the TRD describes broadcasting immer
 * patches via `enablePatches()`. In Phase P1 no real domain commands are
 * registered yet (`CommandRegistry` is still empty — see CLAUDE.md), so
 * there is nothing that produces a meaningful patch stream, and wrapping
 * zustand's immer middleware to expose `produceWithPatches` output adds
 * real complexity for no current benefit. Instead this broadcasts a
 * **debounced full-state snapshot** (just the `AppState` data, via
 * `pickAppState`) on every change. It's simpler, still correct, and the
 * state size here (a few hundred KB at most) is well within what
 * `BroadcastChannel` handles comfortably. Revisit patches if/when payload
 * size becomes a real problem.
 *
 * Leadership: only the leader tab runs the live clock tick and due jobs
 * (`scheduler/useDemoClock.ts`), so jobs never run twice. Any tab can still
 * change state locally (switch role, jump the clock) — that change
 * broadcasts to the others regardless of who's leader. Forwarding a
 * follower's *command* to the leader (TRD §8.2) is deferred until a real
 * command exists to forward (Phase P3+).
 */
'use client';

import { useSyncExternalStore } from 'react';
import { useStore } from './index';
import { APP_STATE_KEYS, pickAppState, type AppState } from './types';

const CHANNEL_NAME = 'amali-demo';
const LEADER_KEY = 'amali-demo:leader';
const LEASE_MS = 4000;
const RENEW_INTERVAL_MS = 2000;
const BROADCAST_DEBOUNCE_MS = 80;

type SyncMessage = { type: 'state'; from: string; state: AppState };

interface Lease {
  tabId: string;
  expires: number;
}

export const tabId: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Math.random());

let channel: BroadcastChannel | null = null;
let leaderTimer: ReturnType<typeof setInterval> | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeStore: (() => void) | null = null;
let applyingRemote = false;
let started = false;

const leaderListeners = new Set<() => void>();
function notifyLeaderListeners(): void {
  leaderListeners.forEach((l) => l());
}

function readLease(): Lease | null {
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    return raw ? (JSON.parse(raw) as Lease) : null;
  } catch {
    return null;
  }
}

function writeLease(): void {
  const lease: Lease = { tabId, expires: Date.now() + LEASE_MS };
  window.localStorage.setItem(LEADER_KEY, JSON.stringify(lease));
}

/** True if this tab currently holds the leader lease. */
export function isLeader(): boolean {
  if (typeof window === 'undefined') return false;
  const lease = readLease();
  return !!lease && lease.tabId === tabId && lease.expires > Date.now();
}

function renewOrClaimLeadership(): void {
  const lease = readLease();
  const now = Date.now();
  const unclaimed = !lease || lease.expires < now;
  const ownedByUs = lease?.tabId === tabId;
  if (unclaimed || ownedByUs) {
    writeLease();
  }
  notifyLeaderListeners();
}

function broadcastState(): void {
  if (!channel) return;
  const message: SyncMessage = {
    type: 'state',
    from: tabId,
    state: pickAppState(useStore.getState()),
  };
  channel.postMessage(message);
}

function scheduleBroadcast(): void {
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    broadcastState();
  }, BROADCAST_DEBOUNCE_MS);
}

function applyRemoteState(state: AppState): void {
  applyingRemote = true;
  try {
    useStore.setState(state);
  } finally {
    applyingRemote = false;
  }
}

function handleMessage(event: MessageEvent<SyncMessage>): void {
  const msg = event.data;
  if (!msg || msg.from === tabId) return;
  if (msg.type === 'state') {
    applyRemoteState(msg.state);
  }
}

/** Starts leader election + BroadcastChannel sync. Call once per tab, on mount. */
export function startSync(): () => void {
  if (started || typeof window === 'undefined') return () => {};
  started = true;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', handleMessage);

  renewOrClaimLeadership();
  leaderTimer = setInterval(renewOrClaimLeadership, RENEW_INTERVAL_MS);

  const onStorage = (e: StorageEvent) => {
    if (e.key === LEADER_KEY) notifyLeaderListeners();
  };
  window.addEventListener('storage', onStorage);

  unsubscribeStore = useStore.subscribe(() => {
    if (applyingRemote) return; // don't rebroadcast what we just applied from another tab
    scheduleBroadcast();
  });

  return stopSync;
}

export function stopSync(): void {
  if (!started) return;
  started = false;
  channel?.removeEventListener('message', handleMessage);
  channel?.close();
  channel = null;
  if (leaderTimer) clearInterval(leaderTimer);
  leaderTimer = null;
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
}

/** React hook: re-renders when leadership changes (tab gains/loses the lease). */
export function useIsLeader(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      leaderListeners.add(onChange);
      return () => leaderListeners.delete(onChange);
    },
    isLeader,
    () => false, // server snapshot — leadership is a client-only concept
  );
}

// Re-exported for callers that just want the full key list without importing store/types directly.
export { APP_STATE_KEYS };
