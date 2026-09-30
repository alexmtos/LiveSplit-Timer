'use client';

import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { accentForeground, getTheme } from '@/lib/themes';

/** Applies the theme colours and the transparent (OBS) background to the document. */
export function ThemeManager() {
  const { settings } = useSettings();
  const theme = getTheme(settings.theme);
  const transparent = settings.chromaKey.enabled;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-main', theme.bg);
    root.style.setProperty('--text-dim', theme.text);
    root.style.setProperty('--theme-accent', theme.accent);
    root.style.setProperty('--theme-accent-rgb', theme.accentRgb);
    root.style.setProperty('--accent-fg', accentForeground(theme.accentRgb));
    // The page background lives on <html>/<body>; it must be cleared too or
    // OBS still captures an opaque rectangle behind the overlay.
    root.style.setProperty('--page-bg', transparent ? 'transparent' : theme.bg);
    root.dataset.transparent = transparent ? 'true' : 'false';
  }, [theme, transparent]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  return null;
}
