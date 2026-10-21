'use client';

/**
 * Per-device language (PRD §14, M29). Each device flips on its own, so dual
 * view can show English and Arabic side by side; the shell stays English.
 */
import { useStore } from '@/store';
import type { DeviceSlotId } from '@/types/demo';

const LOCALES = [
  ['en', 'English'],
  ['ar', 'العربية'],
] as const;

function DeviceLanguage({ slot, label }: { slot: DeviceSlotId; label?: string }) {
  const locale = useStore((s) => s.demo.devices[slot]?.locale);
  const setLocale = useStore((s) => s.setLocale);
  if (!locale) return null;
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-label-3 text-shell-notes-label w-16 shrink-0">{label}</span>}
      <div className="flex flex-1 gap-2">
        {LOCALES.map(([l, name]) => (
          <button
            key={l}
            type="button"
            aria-pressed={locale === l}
            onClick={() => setLocale(slot, l)}
            className={`rounded-button text-label-3 flex-1 border px-2 py-1.5 transition-colors ${
              locale === l
                ? 'border-shell-stage-active bg-shell-stage-active text-shell-stage-active-text'
                : 'border-shell-stage-border text-shell-stage-active hover:bg-shell-stage-border'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Language() {
  const dualView = useStore((s) => s.demo.dualView);
  return (
    <div>
      <h3 className="text-label-2 text-shell-stage-active mb-2">Language</h3>
      <div className="flex flex-col gap-2">
        <DeviceLanguage slot="A" label={dualView ? 'Device A' : undefined} />
        {dualView && <DeviceLanguage slot="B" label="Device B" />}
      </div>
      <p className="text-body-3 text-shell-notes-label mt-1">
        Per device; the shell stays English. Residents can also switch in Profile.
      </p>
    </div>
  );
}
