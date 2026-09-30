'use client';

import React, { useCallback, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { ComparisonGraph } from './ComparisonGraph';
import { Controls } from './Controls';
import { Header } from './Header';
import { Predictions } from './Predictions';
import { SettingsModal } from './SettingsModal';
import { SplitsTable } from './SplitsTable';
import { CommandErrorToast, ConnectionNotice, ResetConfirmToast } from './StatusNotices';
import { ThemeManager } from './ThemeManager';
import { TimerDisplay } from './TimerDisplay';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
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
        'absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-black/40 text-[var(--text-dim)] transition-all hover:border-accent hover:bg-accent/10 hover:text-accent',
        // Stream mode: invisible on the broadcast, revealed on hover or keyboard focus.
        settings.streamMode && 'opacity-0 hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <SettingsIcon size={16} />
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

const ORDER: OverlaySection[] = ['header', 'timer', 'predictions', 'controls', 'graph', 'splits'];

/**
 * The overlay page. With `only`, renders a single section that fills the page
 * (e.g. `/timer` for its own OBS browser source) regardless of the visibility settings.
 */
export function Overlay({ only }: { only?: OverlaySection }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings } = useSettings();
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  useLiveSplitHotkeys(settings.hotkeysEnabled && !isSettingsOpen);

  const sections = only ? [only] : ORDER.filter((section) => settings[SECTION_SETTING[section]]);

  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden font-sans text-white">
      <ThemeManager />

      <div
        id="ls-window"
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 shadow-2xl',
          settings.chromaKey.enabled ? 'bg-transparent' : 'bg-[var(--bg-main)]',
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
  );
}
