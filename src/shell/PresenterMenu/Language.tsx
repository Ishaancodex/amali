'use client';

import { useStore } from '@/store';

export function Language() {
  const locale = useStore((s) => s.demo.devices.A.locale);
  const setLocale = useStore((s) => s.setLocale);

  return (
    <div>
      <h3 className="text-label-2 text-shell-stage-active mb-2">Language</h3>
      <div className="flex gap-2">
        {(['en', 'ar'] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={locale === l}
            onClick={() => setLocale('A', l)}
            className={`rounded-button text-label-3 flex-1 border px-2 py-1.5 transition-colors ${
              locale === l
                ? 'border-shell-stage-active bg-shell-stage-active text-shell-stage-active-text'
                : 'border-shell-stage-border text-shell-stage-active hover:bg-shell-stage-border'
            }`}
          >
            {l === 'en' ? 'English' : 'العربية'}
          </button>
        ))}
      </div>
      <p className="text-body-3 text-shell-notes-label mt-1">
        Flips the device&apos;s direction now; translated content lands in Phase P11.
      </p>
    </div>
  );
}
