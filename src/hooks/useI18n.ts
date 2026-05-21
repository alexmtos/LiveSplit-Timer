'use client';

import { useSettings } from '@/contexts/SettingsContext';
import { translations } from '@/lib/translations';

export function useI18n() {
  const { settings } = useSettings();
  const lang = settings.language;

  const t = (key: string) => {
    return translations[lang]?.[key] || translations['pt-BR']?.[key] || key;
  };

  return { t, lang };
}
