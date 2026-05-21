'use client';

import React from 'react';
import { useTimer, formatDelta } from '@/hooks/useTimer';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { cn } from '@/lib/utils';

export function TimerDisplay() {
  const { formatted, timerState, time } = useTimer();
  const { isConnected, runData } = useLiveSplit();

  const currentIndex = runData?.currentSplitIndex ?? -1;
  const pbForCurrentSplit = currentIndex >= 0
    ? (runData?.run?.segments[currentIndex]?.comparisons?.['Personal Best']?.realTime ?? null)
    : null;
  const currentDelta = pbForCurrentSplit !== null ? time - pbForCurrentSplit : null;

  const deltaClass = currentDelta === null || currentDelta <= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/20 p-4 px-5 min-h-[90px]">
      <div className={cn(
        "font-mono text-3xl font-bold tracking-tighter transition-colors",
        deltaClass
      )}>
        {currentDelta !== null ? formatDelta(currentDelta) : '-'}
      </div>

      <div className={cn(
        "font-mono text-6xl font-extrabold leading-[0.9] tracking-tighter transition-all",
        timerState === 'Paused' ? "opacity-70" : "text-white",
        timerState === 'Ended' && deltaClass,
        !isConnected && "opacity-30"
      )}>
        {formatted.timePart}
        <span className="text-[0.5em] opacity-70">.{formatted.msPart}</span>
      </div>
    </div>
  );
}
