'use client';

import React from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useI18n } from '@/hooks/useI18n';
import { formatTime } from '@/hooks/useTimer';

export function Predictions() {
  const { t } = useI18n();
  const { bestPossibleTime, predictedTime } = useLiveSplit();

  const format = (ms: number | null) => {
    if (ms === null) return '-';
    const f = formatTime(ms);
    return `${f.timePart}.${f.msPart}`;
  };

  return (
    <div className="shrink-0 border-b border-white/10 bg-black/20 p-3 px-5">
      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-dim)]">
            {t('prediction_best_possible')}
          </span>
          <span className="font-mono text-2xl font-bold text-green-500">
            {format(bestPossibleTime)}
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-dim)]">
            {t('prediction_predicted')}
          </span>
          <span className="font-mono text-2xl font-bold text-white">
            {format(predictedTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
