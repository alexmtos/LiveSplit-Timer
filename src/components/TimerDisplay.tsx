'use client';

import React from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunClock } from '@/hooks/useRunClock';
import { deltaTextClass } from '@/lib/colors';
import { currentDelta } from '@/lib/run';
import { formatDelta, formatTimeParts } from '@/lib/time';
import { cn } from '@/lib/utils';

/** `fill`: the timer is alone on the page (e.g. `/timer`), so let it grow with the window. */
export function TimerDisplay({ fill = false }: { fill?: boolean }) {
  const { state, isConnected, comparison, timingMethod } = useLiveSplit();
  const { displayTime, currentTime } = useRunClock();

  const phase = state?.timerState ?? 'NotRunning';
  const delta = state ? currentDelta(state, currentTime, comparison, timingMethod) : null;
  const time = formatTimeParts(displayTime);

  const paused = phase === 'Paused';
  const timerColor = paused
    ? 'text-neutral opacity-70'
    : phase === 'NotRunning' || !delta
      ? 'text-white'
      : deltaTextClass(delta.value);
  const deltaColor = delta ? cn(deltaTextClass(delta.value), paused && 'opacity-50') : 'text-white';

  return (
    <div
      className={cn(
        'flex min-h-[90px] shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4',
        fill && 'flex-1 border-b-0 [container-type:size]',
      )}
    >
      <div
        className={cn(
          'font-mono text-[2rem] font-bold tracking-[-0.5px] transition-colors',
          fill && 'text-[length:min(12cqw,40cqh)]',
          deltaColor,
        )}
        aria-live="off"
      >
        {formatDelta(delta?.value)}
      </div>

      <div
        className={cn(
          'font-mono text-[3.5rem] font-extrabold leading-[0.9] tracking-[-1px] tabular-nums transition-colors',
          fill && 'text-[length:min(22cqw,75cqh)]',
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
