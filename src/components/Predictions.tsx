'use client';

import React from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useI18n } from '@/hooks/useI18n';
import { useRunClock } from '@/hooks/useRunClock';
import { bestPossibleTime, currentPace, pickTime } from '@/lib/run';
import { formatTime } from '@/lib/time';
import { cn } from '@/lib/utils';

/**
 * Best possible time and predicted time, computed locally: the WebSocket
 * server does not answer LiveSplit Server's "getbestpossibletime" /
 * "getpredictedtime" commands.
 */
export function Predictions() {
  const { t } = useI18n();
  const { state, comparison, timingMethod } = useLiveSplit();
  const { currentTime } = useRunClock(100);

  const best = state ? bestPossibleTime(state, currentTime, timingMethod) : null;
  const predicted = state ? currentPace(state, currentTime, comparison, timingMethod) : null;
  const segments = state?.run.segments ?? [];
  const pb = pickTime(segments[segments.length - 1]?.personalBest, timingMethod);
  const predictedClass =
    predicted === null || pb === null || state?.timerState === 'NotRunning'
      ? 'text-white'
      : predicted <= pb
        ? 'text-ahead'
        : 'text-behind';

  return (
    <div className="shrink-0 border-b border-white/10 px-5 py-3">
      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col items-center text-center">
          <span className="mb-1 text-[0.8rem] font-medium uppercase tracking-[0.5px] text-[var(--text-dim)]">
            {t('prediction_best_possible')}
          </span>
          <span className="font-mono text-[1.8rem] font-bold leading-tight tabular-nums text-ahead">{formatTime(best)}</span>
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="mb-1 text-[0.8rem] font-medium uppercase tracking-[0.5px] text-[var(--text-dim)]">
            {t('prediction_predicted')}
          </span>
          <span className={cn('font-mono text-[1.8rem] font-bold leading-tight tabular-nums', predictedClass)}>{formatTime(predicted)}</span>
        </div>
      </div>
    </div>
  );
}
