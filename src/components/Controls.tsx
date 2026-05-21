'use client';

import React from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { Play, Pause, FastForward, RotateCcw, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';

export function Controls() {
  const { isConnected, runData, sendCommand } = useLiveSplit();
  const { settings } = useSettings();

  if (!settings.showControls) return null;

  const timerState = runData?.timerState || 'NotRunning';
  const isRunning = timerState === 'Running';
  const isPaused = timerState === 'Paused';
  const isEnded = timerState === 'Ended';
  const isNotRunning = timerState === 'NotRunning';

  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/20 p-3 px-4">
      <div className="flex flex-1 justify-start">
        <button
          disabled={!isConnected}
          onClick={() => {
            if (isEnded) sendCommand('reset');
            else if (isRunning) sendCommand('split');
            else if (isPaused) sendCommand('resume');
            else sendCommand('starttimer');
          }}
          className={cn(
            "flex h-11 min-w-[44px] items-center justify-center rounded-lg border transition-all disabled:opacity-30",
            isEnded ? "border-red-500 bg-red-500 text-white" : "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white"
          )}
        >
          {isEnded || isNotRunning ? <Play size={20} fill="currentColor" /> : <FastForward size={20} fill="currentColor" />}
        </button>
      </div>

      <div className="flex flex-[2] justify-center gap-2">
        <button
          disabled={!isConnected || !isRunning}
          onClick={() => sendCommand('pause')}
          className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-all disabled:opacity-30"
        >
          <Pause size={18} fill="currentColor" />
        </button>
        <button
          disabled={!isConnected || isNotRunning || isEnded}
          onClick={() => sendCommand('skipsplit')}
          className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-all disabled:opacity-30"
        >
          <FastForward size={18} />
        </button>
        <button
          disabled={!isConnected || isNotRunning}
          onClick={() => sendCommand('unsplit')}
          className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-all disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="flex flex-1 justify-end">
        <button
          disabled={!isConnected || isNotRunning || isEnded}
          onClick={() => {
            if (confirm('Reset timer?')) sendCommand('reset');
          }}
          className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-all disabled:opacity-30"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
