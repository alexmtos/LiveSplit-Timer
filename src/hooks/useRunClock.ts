'use client';

import { useEffect, useState } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { displayTime, extrapolateTime } from '@/lib/run';
import { TIMER_INTERVAL_MS, subscribeTicker } from '@/lib/ticker';

/** `performance.now()`, refreshed by the shared clock (every tick, or about every `intervalMs`) while `active`. */
export function useNow(active: boolean, intervalMs = TIMER_INTERVAL_MS): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!active) return;
    return subscribeTicker(intervalMs, setNow);
  }, [active, intervalMs]);

  return now;
}

/**
 * Live run time. `displayTime` is what the big timer shows; `currentTime` is
 * the time in the active timing method (null when LiveSplit has no game time
 * yet) and is what deltas and predictions must use.
 */
export function useRunClock(intervalMs = TIMER_INTERVAL_MS) {
  const { state, anchor, timingMethod } = useLiveSplit();
  const now = useNow(state?.timerState === 'Running', intervalMs);
  // Before the start LiveSplit shows the run's start offset (e.g. -5.00 for a countdown).
  const offset = state?.timerState === 'NotRunning' ? state.run.startingOffset : null;
  return {
    displayTime: offset ?? displayTime(anchor, timingMethod, now),
    currentTime: anchor ? extrapolateTime(anchor, timingMethod, now) : null,
  };
}
