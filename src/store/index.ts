/**
 * The single shared store (TRD §8.1). Every device frame reads from this —
 * an action on one surface is visible on every other surface within a
 * render frame (PRD rule #3). Components never write to the store
 * directly; they call `dispatch(command, input, actor)`.
 */
'use client';

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { RootStore } from './types';
import { createCommunitySlice } from './slices/community';
import { createAmenitiesSlice } from './slices/amenities';
import { createBookingsSlice } from './slices/bookings';
import { createEventsSlice } from './slices/events';
import { createCrecheSlice } from './slices/creche';
import { createDiningSlice } from './slices/dining';
import { createWalletSlice } from './slices/wallet';
import { createOpsSlice } from './slices/ops';
import { createCommsSlice } from './slices/comms';
import { createNotificationsSlice } from './slices/notifications';
import { createAuditSlice } from './slices/audit';
import { createSchedulerSlice } from './slices/scheduler';
import { createDemoSlice, STATE_VERSION } from './slices/demo';
import { createDispatchSlice } from './commands/dispatch';
import { migrate } from './migrate';

const PERSIST_KEY = 'amali-demo:v1';
const DEBOUNCE_MS = 300;

/** localStorage wrapped with a per-key debounce (TRD §8.1 `debouncedStorage(300)`). */
function debouncedStorage(delayMs: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    getItem: (name: string): string | null => {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(name);
    },
    setItem: (name: string, value: string): void => {
      if (typeof window === 'undefined') return;
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => {
          window.localStorage.setItem(name, value);
          timers.delete(name);
        }, delayMs),
      );
    },
    removeItem: (name: string): void => {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(name);
    },
  };
}

const persistedStorage = debouncedStorage(DEBOUNCE_MS);

export const useStore = create<RootStore>()(
  subscribeWithSelector(
    persist(
      immer((...a) => ({
        ...createCommunitySlice(...a),
        ...createAmenitiesSlice(...a),
        ...createBookingsSlice(...a),
        ...createEventsSlice(...a),
        ...createCrecheSlice(...a),
        ...createDiningSlice(...a),
        ...createWalletSlice(...a),
        ...createOpsSlice(...a),
        ...createCommsSlice(...a),
        ...createNotificationsSlice(...a),
        ...createAuditSlice(...a),
        ...createSchedulerSlice(...a),
        ...createDemoSlice(...a),
        ...createDispatchSlice(...a),
      })),
      {
        name: PERSIST_KEY,
        version: STATE_VERSION,
        migrate,
        storage: {
          getItem: (name) => {
            const raw = persistedStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          },
          setItem: (name, value) => persistedStorage.setItem(name, JSON.stringify(value)),
          removeItem: (name) => persistedStorage.removeItem(name),
        },
      },
    ),
  ),
);
