/**
 * i18next instances (PRD §14, TRD §9). Each device frame has its own
 * language, so there is one instance per locale rather than one global
 * `i18n.changeLanguage` — device A can show English while device B shows
 * Arabic. English is bundled; Arabic is a separate chunk loaded the first
 * time a device switches to it (`ensureLocale`).
 */
import i18next, { type i18n } from 'i18next';
import en from './en.json';

export type Locale = 'en' | 'ar';

function create(lng: Locale): i18n {
  const instance = i18next.createInstance();
  void instance.init({
    lng,
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return instance;
}

export const instances: Record<Locale, i18n> = { en: create('en'), ar: create('ar') };

let arLoad: Promise<void> | undefined;

/** Resolves once `locale`'s strings are available (Arabic loads on first use). */
export function ensureLocale(locale: Locale): Promise<void> {
  if (locale === 'en') return Promise.resolve();
  arLoad ??= import('./ar.json').then((mod) => {
    instances.ar.addResourceBundle('ar', 'translation', mod.default, true, true);
  });
  return arLoad;
}

export function isLocaleReady(locale: Locale): boolean {
  return locale === 'en' || instances.ar.hasResourceBundle('ar', 'translation');
}
