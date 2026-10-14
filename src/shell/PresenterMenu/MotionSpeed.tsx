'use client';

import { useStore } from '@/store';
import type { MotionSpeed as MotionSpeedValue } from '@/types/demo';

const OPTIONS: { value: MotionSpeedValue; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
];

export function MotionSpeed() {
  const speed = useStore((s) => s.demo.motionSpeed);
  const setMotionSpeed = useStore((s) => s.setMotionSpeed);

  return (
    <div>
      <h3 className="text-label-2 text-shell-stage-active mb-2">Motion speed</h3>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={speed === opt.value}
            onClick={() => setMotionSpeed(opt.value)}
            className={`rounded-button text-label-3 flex-1 border px-2 py-1.5 transition-colors ${
              speed === opt.value
                ? 'border-shell-stage-active bg-shell-stage-active text-shell-stage-active-text'
                : 'border-shell-stage-border text-shell-stage-active hover:bg-shell-stage-border'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
