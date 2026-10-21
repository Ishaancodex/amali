'use client';

/**
 * The hooks every device surface uses for copy and formatting. They read the
 * i18next instance from the nearest `DeviceLocale` provider, so each device
 * follows its own language.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { fmtFor, type Fmt } from './format';
import type { Locale } from './instances';
import type { AmenityKey } from '@/types/amenity';

export type T = TFunction;

export function useT(): TFunction {
  return useTranslation().t;
}

export function useLocale(): Locale {
  return useTranslation().i18n.language === 'ar' ? 'ar' : 'en';
}

export function useFmt(): Fmt {
  return fmtFor(useLocale());
}

interface ErrorLike {
  code: string;
  message: string;
  params?: Record<string, string | number>;
}

/**
 * A command or rule rejection as text. English keeps the command's own,
 * most specific message; other languages use the per-code translation
 * (`errors.<CODE>`) and fall back to the English message.
 */
export function useErrorText(): (error: ErrorLike | undefined) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (error) => {
      if (!error) return '';
      if (i18n.language === 'en') return error.message;
      const key = `errors.${error.code}`;
      return i18n.exists(key)
        ? (t as unknown as (k: string, o: object) => string)(key, error.params ?? {})
        : error.message;
    },
    [t, i18n],
  );
}

/** An amenity's name, short name or location in the device's language (seeded names are English data). */
export function useAmenityLabel(): (
  key: AmenityKey,
  form?: 'name' | 'short' | 'location',
) => string {
  const t = useT();
  return useCallback((key, form = 'name') => t(`amenity.${key}.${form}`), [t]);
}
