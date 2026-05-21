'use client';

import React from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useI18n } from '@/hooks/useI18n';
import { Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import { formatTime } from '@/hooks/useTimer';

export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { runData, worldRecord } = useLiveSplit();
  const { t } = useI18n();

  const formattedWR = worldRecord?.timeMs ? formatTime(worldRecord.timeMs) : null;

  return (
    <header className="relative flex flex-col gap-1 border-b border-white/10 bg-black/30 p-3 px-4 min-h-[70px] shrink-0">
      <div className="absolute top-3 right-4">
        <button
          onClick={onOpenSettings}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--text-dim)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 hover:text-[var(--theme-accent)] transition-all"
        >
          <SettingsIcon size={16} />
        </button>
      </div>

      <div className="flex flex-col pr-10">
        <h1 className="truncate text-base font-bold text-[var(--theme-accent)] leading-tight">
          {runData?.gameName || '-'}
        </h1>
        <p className="truncate font-mono text-[11px] tracking-tight text-[var(--text-dim)]">
          {runData?.categoryName || '-'}
        </p>
      </div>

      <div className="flex items-center gap-4 text-[11px] font-mono tracking-tight text-[var(--text-dim)]">
        <span>{t('pb_display')}: {runData?.run?.segments && runData.run.segments.length > 0 ? formatPB(runData.run.segments) : '-'}</span>
        {worldRecord ? (
          <a
            href={worldRecord.url || '#'}
            target="_blank"
            className="group flex items-center gap-1 hover:text-[var(--theme-accent)] transition-colors"
          >
            {t('wr_display')}: {formattedWR ? `${formattedWR.timePart}.${formattedWR.msPart}` : '-'} {t('wr_by')} {worldRecord.player}
            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ) : (
          <span>{t('wr_display')}: -</span>
        )}
      </div>
    </header>
  );
}

import { Segment } from '@/types';

function formatPB(segments: Segment[]) {
  const last = segments[segments.length - 1];
  const pb = last?.comparisons?.['Personal Best']?.realTime;
  if (!pb) return '-';
  const f = formatTime(pb);
  return `${f.timePart}.${f.msPart}`;
}
