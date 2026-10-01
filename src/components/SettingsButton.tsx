'use client';

import React, { createContext, useContext } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { GearIcon } from './icons';

/**
 * Where the settings button goes: inside the timer section, vertically centred
 * (`timer`), in the window's top-right corner when the timer isn't shown
 * (`window`), or nowhere (image export).
 */
export type SettingsButtonPlacement = 'timer' | 'window' | 'none';

const SettingsButtonContext = createContext<{ placement: SettingsButtonPlacement; open: () => void }>({
  placement: 'none',
  open: () => {},
});

export const SettingsButtonProvider = SettingsButtonContext.Provider;

export function useSettingsButtonPlacement() {
  return useContext(SettingsButtonContext).placement;
}

/** Renders the settings button if `at` is where it belongs. */
export function SettingsButton({ at }: { at: Exclude<SettingsButtonPlacement, 'none'> }) {
  const { placement, open } = useContext(SettingsButtonContext);
  const { settings } = useSettings();
  const { isConnected } = useLiveSplit();
  const { t } = useI18n();
  if (placement !== at) return null;
  return (
    <button
      type="button"
      // Keep focus off the button so a later Space press still splits.
      onMouseDown={(event) => event.preventDefault()}
      onClick={open}
      aria-label={t('btn_settings')}
      title={t('btn_settings')}
      data-export-ignore
      className={cn(
        'z-30 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition-all hover:border-accent hover:bg-accent/10 hover:text-accent',
        at === 'window' ? 'absolute right-4 top-3' : 'relative self-center',
        // Stream mode: invisible on the broadcast, revealed on hover or keyboard focus.
        settings.streamMode && 'opacity-0 hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <GearIcon size={20} />
      {!isConnected && !settings.streamMode && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black bg-red-500" aria-hidden />
      )}
    </button>
  );
}
