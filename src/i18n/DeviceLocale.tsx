'use client';

/**
 * Per-device language (PRD §14, M29). Provides the device's i18next
 * instance and flips `dir`/`lang` with a cross-fade: the content fades out,
 * the language and direction change, and it fades back in. Nothing remounts,
 * so form state survives the switch.
 */
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { motion, useAnimationControls } from 'motion/react';
import { localeFade } from '@/design/motion';
import { ensureLocale, instances, isLocaleReady, type Locale } from './instances';

/** The language the device currently shows — it trails the requested one by one fade. */
export function useShownLocale(requested: Locale) {
  const [shown, setShown] = useState<Locale>(() => (isLocaleReady(requested) ? requested : 'en'));
  const controls = useAnimationControls();

  useEffect(() => {
    if (requested === shown) return;
    let cancelled = false;
    void (async () => {
      await ensureLocale(requested);
      if (cancelled) return;
      await controls.start(localeFade(0));
      if (cancelled) return;
      setShown(requested);
      void controls.start(localeFade(1));
    })();
    return () => {
      cancelled = true;
    };
  }, [requested, shown, controls]);

  return { shown, controls };
}

export function DeviceLocale({
  locale,
  controls,
  children,
}: {
  locale: Locale;
  controls: ReturnType<typeof useAnimationControls>;
  children: React.ReactNode;
}) {
  return (
    <I18nextProvider i18n={instances[locale]}>
      <motion.div animate={controls} className="h-full w-full">
        {children}
      </motion.div>
    </I18nextProvider>
  );
}
