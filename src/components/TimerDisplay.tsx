'use client';

import React from 'react';
import { useTimer } from '@/hooks/useTimer';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { cn } from '@/lib/utils';

export function TimerDisplay() {
  const { formatted, timerState } = useTimer();
  const { isConnected } = useLiveSplit();

  // Basic delta display logic - could be expanded
  const currentDelta = 0; // Simplified for now

  const deltaClass = currentDelta <= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/20 p-4 px-5 min-h-[90px]">
      <div className={cn(
        "font-mono text-3xl font-bold tracking-tighter transition-colors",
        deltaClass
      )}>
        -
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
