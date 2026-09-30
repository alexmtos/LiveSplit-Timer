'use client';

import { useEffect, useState } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { displayTime, extrapolateTime } from '@/lib/run';

/** `performance.now()`, refreshed every animation frame (or every `intervalMs`) while `active`. */
export function useNow(active: boolean, intervalMs = 0): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last >= intervalMs) {
        last = time;
        setNow(time);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, intervalMs]);

  return now;
}

/**
 * Live run time. `displayTime` is what the big timer shows; `currentTime` is
 * the time in the active timing method (null when LiveSplit has no game time
 * yet) and is what deltas and predictions must use.
 */
export function useRunClock(intervalMs = 0) {
  const { state, anchor, timingMethod } = useLiveSplit();
  const now = useNow(state?.timerState === 'Running', intervalMs);
  return {
    displayTime: displayTime(anchor, timingMethod, now),
    currentTime: anchor ? extrapolateTime(anchor, timingMethod, now) : null,
  };
}
