'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, detectLanguage, sanitizeSettings } from '@/lib/settings';

interface SettingsContextType {
  settings: Settings;
  /** False until the saved settings have been read from localStorage. */
  isLoaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function browserLanguage() {
  return detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let saved: unknown = null;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Failed to read saved settings', error);
    }
    // Reading localStorage has to wait for the client; this runs once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(sanitizeSettings(saved, browserLanguage()));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings', error);
    }
  }, [settings, isLoaded]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, language: browserLanguage() });
  }, []);

  const value = useMemo(
    () => ({ settings, isLoaded, updateSettings, resetSettings }),
    [settings, isLoaded, updateSettings, resetSettings],
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
