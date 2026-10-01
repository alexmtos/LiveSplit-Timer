'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Settings } from '@/types';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  detectLanguage,
  parseUrlOverrides,
  sanitizeSettings,
} from '@/lib/settings';

interface SettingsContextType {
  /** Effective settings: saved settings with the page URL's overrides on top. */
  settings: Settings;
  /** Settings keys currently forced by the page URL (not saved). */
  overriddenKeys: (keyof Settings)[];
  /** False until the saved settings have been read from localStorage. */
  isLoaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
  /** Back to the defaults; `keepConnection` keeps the LiveSplit address and token. */
  resetSettings: (options?: { keepConnection?: boolean }) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function browserLanguage() {
  return detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Settings>(DEFAULT_SETTINGS);
  const [overrides, setOverrides] = useState<Partial<Settings>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let stored: unknown = null;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to read saved settings', error);
    }
    const loaded = sanitizeSettings(stored, browserLanguage());
    // localStorage and the URL are only available on the client; this runs once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(loaded);
    setOverrides(parseUrlOverrides(window.location.search, loaded.wsUrl));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      console.error('Failed to save settings', error);
    }
  }, [saved, isLoaded]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSaved((prev) => ({ ...prev, ...updates }));
    // A change made in the settings panel wins over the URL for this page.
    setOverrides((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(updates) as (keyof Settings)[]) delete next[key];
      return next;
    });
  }, []);

  const resetSettings = useCallback((options: { keepConnection?: boolean } = {}) => {
    setSaved((prev) => ({
      ...DEFAULT_SETTINGS,
      language: browserLanguage(),
      ...(options.keepConnection && { wsUrl: prev.wsUrl, token: prev.token }),
    }));
    setOverrides({});
  }, []);

  const value = useMemo(
    () => ({
      settings: { ...saved, ...overrides },
      overriddenKeys: Object.keys(overrides) as (keyof Settings)[],
      isLoaded,
      updateSettings,
      resetSettings,
    }),
    [saved, overrides, isLoaded, updateSettings, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
