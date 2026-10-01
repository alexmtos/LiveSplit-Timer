'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { deltaTextClass } from '@/lib/colors';
import { currentDelta, displayTime, extrapolateTime, type TimeAnchor } from '@/lib/run';
import { TIMER_INTERVAL_MS, subscribeTicker } from '@/lib/ticker';
import { formatDelta, formatTimeParts } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { LiveSplitState, TimingMethod } from '@/types';
import { SettingsButton } from './SettingsButton';

type Tone = 'ahead' | 'behind' | 'none';

const toneOf = (delta: number | null | undefined): Tone =>
  delta === null || delta === undefined ? 'none' : delta <= 0 ? 'ahead' : 'behind';

/** What the timer shows at `now`. */
function reading(state: LiveSplitState | null, anchor: TimeAnchor | null, comparison: string, method: TimingMethod, now: number) {
  // Before the start LiveSplit shows the run's start offset (e.g. -5.00 for a countdown).
  const offset = state?.timerState === 'NotRunning' ? state.run.startingOffset : null;
  const time = formatTimeParts(offset ?? displayTime(anchor, method, now));
  const currentTime = anchor ? extrapolateTime(anchor, method, now) : null;
  const delta = state ? currentDelta(state, currentTime, comparison, method) : null;
  return { main: `${time.sign}${time.main}`, fraction: `.${time.fraction}`, delta: formatDelta(delta?.value), tone: toneOf(delta?.value) };
}

/**
 * `fill`: the timer is alone on the page (e.g. `/timer`), so let it grow with the window.
 *
 * While the timer runs, the time and the delta are written straight into the
 * page by the shared ticker, only when what they show changes: re-rendering
 * React 40 times a second was most of the overlay's CPU use.
 */
export function TimerDisplay({ fill = false }: { fill?: boolean }) {
  const { state, anchor, isConnected, comparison, timingMethod } = useLiveSplit();
  const timerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLSpanElement>(null);
  const fractionRef = useRef<HTMLSpanElement>(null);
  const deltaRef = useRef<HTMLDivElement>(null);

  const phase = state?.timerState ?? 'NotRunning';
  const paused = phase === 'Paused';
  // Rendered as of when the state arrived; the effect below brings it up to date at once.
  const initial = reading(state, anchor, comparison, timingMethod, anchor?.receivedAt ?? 0);

  // Every class the two lines can take, worked out once per render rather than on every tick.
  const classes = useMemo(() => {
    const timerBase = cn(
      'ml-auto font-mono text-[3.5rem] font-extrabold leading-[0.9] tracking-[-1px] tabular-nums transition-colors',
      fill && 'text-[length:min(22cqw,75cqh)]',
      !isConnected && 'opacity-30',
    );
    const deltaBase = cn(
      'font-mono text-[2rem] font-bold tracking-[-0.5px] transition-colors',
      fill && 'text-[length:min(12cqw,40cqh)]',
    );
    const timerTone = (tone: Tone) =>
      cn(timerBase, paused ? 'text-neutral opacity-70' : phase === 'NotRunning' || tone === 'none' ? 'text-white' : deltaTextClass(tone === 'ahead' ? -1 : 1));
    const deltaTone = (tone: Tone) =>
      cn(deltaBase, tone === 'none' ? 'text-white' : cn(deltaTextClass(tone === 'ahead' ? -1 : 1), paused && 'opacity-50'));
    const tones: Tone[] = ['ahead', 'behind', 'none'];
    return {
      timer: Object.fromEntries(tones.map((tone) => [tone, timerTone(tone)])) as Record<Tone, string>,
      delta: Object.fromEntries(tones.map((tone) => [tone, deltaTone(tone)])) as Record<Tone, string>,
    };
  }, [fill, isConnected, paused, phase]);

  useEffect(() => {
    const write = (now: number) => {
      const next = reading(state, anchor, comparison, timingMethod, now);
      const set = (element: HTMLElement | null, text: string) => {
        if (element && element.textContent !== text) element.textContent = text;
      };
      set(mainRef.current, next.main);
      set(fractionRef.current, next.fraction);
      set(deltaRef.current, next.delta);
      const timerClass = classes.timer[next.tone];
      const deltaClass = classes.delta[next.tone];
      if (timerRef.current && timerRef.current.className !== timerClass) timerRef.current.className = timerClass;
      if (deltaRef.current && deltaRef.current.className !== deltaClass) deltaRef.current.className = deltaClass;
    };
    write(performance.now());
    if (state?.timerState !== 'Running') return;
    return subscribeTicker(TIMER_INTERVAL_MS, write);
  }, [state, anchor, comparison, timingMethod, classes]);

  return (
    <div
      className={cn(
        'group/timer flex min-h-[90px] shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4',
        fill && 'flex-1 border-b-0 [container-type:size]',
      )}
    >
      <div ref={deltaRef} className={classes.delta[initial.tone]} aria-live="off">
        {initial.delta}
      </div>

      <div ref={timerRef} className={classes.timer[initial.tone]}>
        <span ref={mainRef}>{initial.main}</span>
        <span ref={fractionRef} className="text-[0.5em] opacity-70">
          {initial.fraction}
        </span>
      </div>

      <SettingsButton at="timer" />
    </div>
  );
}
