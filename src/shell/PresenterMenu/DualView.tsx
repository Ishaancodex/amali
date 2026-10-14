'use client';

import { useStore } from '@/store';

export function DualView() {
  const dualView = useStore((s) => s.demo.dualView);
  const setDualView = useStore((s) => s.setDualView);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-label-2 text-shell-stage-active">Dual view</h3>
        <p className="text-body-3 text-shell-notes-label">
          Two device frames side by side. Toggle with D.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dualView}
        onClick={() => setDualView(!dualView)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          dualView ? 'bg-brand' : 'bg-shell-stage-border'
        }`}
      >
        <span
          className={`bg-shell-stage-active absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
            dualView ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
