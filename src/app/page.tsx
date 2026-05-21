'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { TimerDisplay } from '@/components/TimerDisplay';
import { Predictions } from '@/components/Predictions';
import { Controls } from '@/components/Controls';
import { SplitsTable } from '@/components/SplitsTable';
import { SettingsModal } from '@/components/SettingsModal';
import { ComparisonGraph } from '@/components/ComparisonGraph';
import { ThemeManager } from '@/lib/themes';
import { useSettings } from '@/contexts/SettingsContext';
import { useLiveSplitHotkeys } from '@/hooks/useLiveSplitHotkeys';
import { cn } from '@/lib/utils';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings } = useSettings();

  // Activate hotkeys
  useLiveSplitHotkeys();

  return (
    <main className={cn(
      "relative flex h-screen w-full flex-col overflow-hidden bg-[var(--bg-main)] text-white font-sans transition-colors",
      settings.chromaKey.enabled && "bg-transparent"
    )}>
      <ThemeManager />

      <div id="ls-window" className="flex h-full w-full flex-col border border-white/10 rounded-lg overflow-hidden shadow-2xl">
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />
        <TimerDisplay />
        <Predictions />
        <Controls />
        <ComparisonGraph />
        <SplitsTable />
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
}
