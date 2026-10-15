'use client';

/**
 * Store-connected toast renderer for one device slot. Lives in shell/ (not
 * ui/) because it reads `uiStore` directly — ui/* primitives stay
 * presentational and take their data via props (TRD layering rule).
 */
import { AnimatePresence } from 'motion/react';
import { useUiStore } from '@/store/uiStore';
import { Toast } from '@/ui/Toast';
import type { DeviceSlotId } from '@/types/demo';

export function ToastHost({ slot }: { slot: DeviceSlotId }) {
  const toasts = useUiStore((s) => s.toasts[slot] ?? []);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            variant={t.variant}
            onDismiss={() => dismiss(slot, t.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
