'use client';

import { useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { translations, type TranslationKey } from '@/lib/translations';

export function useI18n() {
  const { settings } = useSettings();
  const lang = settings.language;

  const t = useCallback(
    (key: TranslationKey) => translations[lang]?.[key] ?? translations['en-US'][key] ?? key,
    [lang],
  );

  return { t, lang };
}
