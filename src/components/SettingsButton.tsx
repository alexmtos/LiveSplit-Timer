'use client';

import React, { createContext, useContext } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import type { OverlaySection } from '@/types';
import { GearIcon } from './icons';

/**
 * Where the settings button goes: in the section at the top of the page, which
 * makes room for it, or in the window's top-right corner (`window`) when that
 * section is the graph or the splits, which must not move. `none` for the image export.
 */
export type SettingsButtonPlacement = OverlaySection | 'window' | 'none';

/** Sections that never make room for the button: it floats over the window's corner instead. */
const FLOATING: ReadonlySet<OverlaySection> = new Set(['graph', 'splits']);

export function settingsButtonPlacement(topSection: OverlaySection | undefined): SettingsButtonPlacement {
  return topSection === undefined || FLOATING.has(topSection) ? 'window' : topSection;
}

const SettingsButtonContext = createContext<{ placement: SettingsButtonPlacement; open: () => void }>({
  placement: 'none',
  open: () => {},
});

export const SettingsButtonProvider = SettingsButtonContext.Provider;

export function useSettingsButtonPlacement() {
  return useContext(SettingsButtonContext).placement;
}

/**
 * How the button sits in its section:
 * - `slide`: beside the content. Hidden in stream mode it takes no room, and the
 *   content slides over when it appears on hover of the section (which needs the
 *   `group/host` class); `className` (applied only then) must cancel the section's gap.
 * - `keep`: beside the content, keeping its room even while hidden in stream mode,
 *   so buttons next to it never move under the cursor.
 * - `corner`: positioned by `className` over room the section leaves free.
 */
type Layout = 'slide' | 'keep' | 'corner';

/** Renders the settings button if `at` is where it belongs. */
export function SettingsButton({
  at,
  layout,
  className,
}: {
  at: Exclude<SettingsButtonPlacement, 'none'>;
  layout: Layout;
  className?: string;
}) {
  const { placement, open } = useContext(SettingsButtonContext);
  const { settings } = useSettings();
  const { isConnected } = useLiveSplit();
  const { t } = useI18n();
  if (placement !== at) return null;
  const hidden = settings.streamMode;
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
        layout === 'corner' ? 'absolute' : 'relative self-center',
        // Stream mode: invisible on the broadcast, revealed on hover or keyboard focus.
        hidden && layout !== 'slide' && 'opacity-0 hover:opacity-100 focus-visible:opacity-100',
        hidden &&
          layout === 'slide' &&
          'w-0 overflow-hidden border-0 opacity-0 group-hover/host:w-8 group-hover/host:border group-hover/host:opacity-100 focus-visible:w-8 focus-visible:border focus-visible:opacity-100',
        (layout !== 'slide' || hidden) && className,
      )}
    >
      <GearIcon size={20} />
      {!isConnected && !settings.streamMode && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black bg-red-500" aria-hidden />
      )}
    </button>
  );
}
