'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ComparisonGraph } from './ComparisonGraph';
import { Controls } from './Controls';
import { ExportViewProvider } from './ExportView';
import { GearIcon } from './icons';
import { Header } from './Header';
import { Predictions } from './Predictions';
import { SettingsModal } from './SettingsModal';
import { SplitsTable } from './SplitsTable';
import { CommandErrorToast, ConnectionNotice, ResetConfirmToast } from './StatusNotices';
import { ThemeManager } from './ThemeManager';
import { TimerDisplay } from './TimerDisplay';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { SelectionProvider } from '@/contexts/SelectionContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { useLiveSplitHotkeys } from '@/hooks/useLiveSplitHotkeys';
import { cn } from '@/lib/utils';
import { SECTION_SETTING, type OverlaySection } from '@/types';

function SettingsButton({ onClick }: { onClick: () => void }) {
  const { settings } = useSettings();
  const { isConnected } = useLiveSplit();
  const { t } = useI18n();
  return (
    <button
      type="button"
      // Keep focus off the button so a later Space press still splits.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={t('btn_settings')}
      title={t('btn_settings')}
      data-export-ignore
      className={cn(
        'absolute right-4 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition-all hover:border-accent hover:bg-accent/10 hover:text-accent',
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

const SECTIONS: Record<OverlaySection, (fill: boolean) => React.ReactNode> = {
  header: () => <Header />,
  timer: (fill) => <TimerDisplay fill={fill} />,
  predictions: () => <Predictions />,
  controls: (fill) => <Controls fill={fill} />,
  graph: (fill) => <ComparisonGraph fill={fill} />,
  splits: () => <SplitsTable />,
};

/** Delay before opening the settings when LiveSplit is unreachable after the page loads. */
const AUTO_OPEN_MS = 3_000;

const ORDER: OverlaySection[] = ['header', 'timer', 'predictions', 'graph', 'controls', 'splits'];

/**
 * The overlay page. With `only`, renders a single section that fills the page
 * (e.g. `/timer` for its own OBS browser source) regardless of the visibility settings.
 */
export function Overlay({ only }: { only?: OverlaySection }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, isLoaded } = useSettings();
  const { status } = useLiveSplit();
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  // Like before, open the settings when LiveSplit can't be reached shortly after
  // the page loads, so the address can be fixed. Never on stream (stream mode or
  // a single-section OBS page).
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  // Decided once, when the saved settings are known; later changes (e.g. turning
  // stream mode off) never schedule it again.
  const autoOpenDecided = useRef(false);
  useEffect(() => {
    if (!isLoaded || autoOpenDecided.current) return;
    if (only || settings.streamMode) {
      autoOpenDecided.current = true;
      return;
    }
    const id = setTimeout(() => {
      autoOpenDecided.current = true;
      if (statusRef.current !== 'connected') setIsSettingsOpen(true);
    }, AUTO_OPEN_MS);
    return () => clearTimeout(id);
  }, [isLoaded, only, settings.streamMode]);

  useLiveSplitHotkeys(settings.hotkeysEnabled && !isSettingsOpen);

  const sections = only ? [only] : ORDER.filter((section) => settings[SECTION_SETTING[section]]);

  return (
    <SelectionProvider>
      <ExportViewProvider>
        <main className="relative flex h-screen w-full flex-col overflow-hidden font-sans text-white">
          <ThemeManager />

          <div
            id="ls-window"
            className={cn(
              'relative flex h-full w-full flex-col overflow-hidden rounded-lg border shadow-2xl',
              settings.chromaKey.enabled ? 'border-transparent bg-transparent' : 'border-white/10 bg-[var(--bg-main)]',
              only && only !== 'splits' && 'justify-center',
            )}
          >
            <SettingsButton onClick={openSettings} />
            {sections.map((section, index) => (
              <React.Fragment key={section}>
                {SECTIONS[section](!!only)}
                {/* Connection problems show right under the first section. */}
                {index === 0 && <ConnectionNotice />}
              </React.Fragment>
            ))}
            {sections.length === 0 && <ConnectionNotice />}
          </div>

          <ResetConfirmToast />
          <CommandErrorToast />
          <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
        </main>
      </ExportViewProvider>
    </SelectionProvider>
  );
}
