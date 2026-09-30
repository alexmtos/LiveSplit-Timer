'use client';

import React from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunClock } from '@/hooks/useRunClock';
import { deltaTextClass } from '@/lib/colors';
import { currentDelta } from '@/lib/run';
import { formatDelta, formatTimeParts } from '@/lib/time';
import { cn } from '@/lib/utils';

export function TimerDisplay() {
  const { state, isConnected, comparison, timingMethod } = useLiveSplit();
  const { displayTime, currentTime } = useRunClock();

  const phase = state?.timerState ?? 'NotRunning';
  const delta = state ? currentDelta(state, currentTime, comparison, timingMethod) : null;
  const time = formatTimeParts(displayTime);

  const timerColor =
    phase === 'Paused' ? 'text-gray-400' : phase === 'NotRunning' || !delta ? 'text-white' : deltaTextClass(delta.value);

  return (
    <div className="flex min-h-[90px] shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-black/20 p-4 px-5">
      <div
        className={cn('font-mono text-3xl font-bold tracking-tighter transition-colors', deltaTextClass(delta?.value))}
        aria-live="off"
      >
        {formatDelta(delta?.value)}
      </div>

      <div
        className={cn(
          'font-mono text-6xl font-extrabold leading-[0.9] tracking-tighter tabular-nums transition-colors',
          timerColor,
          !isConnected && 'opacity-30',
        )}
      >
        {time.sign}
        {time.main}
        <span className="text-[0.5em] opacity-70">.{time.fraction}</span>
      </div>
    </div>
  );
}
