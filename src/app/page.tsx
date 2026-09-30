'use client';

import React, { useCallback, useState } from 'react';
import { ComparisonGraph } from '@/components/ComparisonGraph';
import { Controls } from '@/components/Controls';
import { Header } from '@/components/Header';
import { Predictions } from '@/components/Predictions';
import { SettingsModal } from '@/components/SettingsModal';
import { SplitsTable } from '@/components/SplitsTable';
import { ConnectionNotice, ResetConfirmToast } from '@/components/StatusNotices';
import { ThemeManager } from '@/components/ThemeManager';
import { TimerDisplay } from '@/components/TimerDisplay';
import { useSettings } from '@/contexts/SettingsContext';
import { useLiveSplitHotkeys } from '@/hooks/useLiveSplitHotkeys';
import { cn } from '@/lib/utils';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings } = useSettings();
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  useLiveSplitHotkeys(settings.hotkeysEnabled && !isSettingsOpen);

  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden font-sans text-white">
      <ThemeManager />

      <div
        id="ls-window"
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 shadow-2xl',
          settings.chromaKey.enabled ? 'bg-transparent' : 'bg-[var(--bg-main)]',
        )}
      >
        <Header onOpenSettings={openSettings} />
        <ConnectionNotice />
        <TimerDisplay />
        <Predictions />
        <Controls />
        <ComparisonGraph />
        <SplitsTable />
      </div>

      <ResetConfirmToast />
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </main>
  );
}
