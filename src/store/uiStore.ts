/**
 * Ephemeral, non-persisted UI state (TRD §8.1): toasts, per device slot so
 * dual view keeps each frame's feedback independent. Never persisted and
 * never synced across tabs — purely local presentation state.
 */
'use client';

import { create } from 'zustand';
import { id } from '@/lib/ids';
import type { DeviceSlotId } from '@/types/demo';

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'neutral';
}

interface UiState {
  toasts: Partial<Record<DeviceSlotId, ToastItem[]>>;
  pushToast: (slot: DeviceSlotId, message: string, variant?: ToastItem['variant']) => void;
  dismissToast: (slot: DeviceSlotId, toastId: string) => void;
  /** Bumped by Reset — each device plays the logo splash (PRD M28). */
  resetCount: number;
  markReset: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  toasts: { A: [] },
  resetCount: 0,
  markReset: () => set((s) => ({ resetCount: s.resetCount + 1 })),

  pushToast: (slot, message, variant = 'neutral') =>
    set((s) => ({
      toasts: {
        ...s.toasts,
        [slot]: [...(s.toasts[slot] ?? []), { id: id('notif'), message, variant }],
      },
    })),

  dismissToast: (slot, toastId) =>
    set((s) => ({
      toasts: { ...s.toasts, [slot]: (s.toasts[slot] ?? []).filter((t) => t.id !== toastId) },
    })),
}));
