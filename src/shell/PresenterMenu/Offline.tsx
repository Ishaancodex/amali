'use client';

import { useStore } from '@/store';

export function Offline() {
  const offline = useStore((s) => s.demo.devices.A.offline);
  const setDeviceOffline = useStore((s) => s.setDeviceOffline);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-label-2 text-shell-stage-active">Offline</h3>
        <p className="text-body-3 text-shell-notes-label">
          Shows the device&apos;s offline state (PRD §11).
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={offline}
        onClick={() => setDeviceOffline('A', !offline)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          offline ? 'bg-brand' : 'bg-shell-stage-border'
        }`}
      >
        <span
          className={`bg-shell-stage-active absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
            offline ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
