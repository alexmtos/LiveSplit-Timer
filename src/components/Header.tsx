'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useI18n } from '@/hooks/useI18n';
import { PERSONAL_BEST, pickTime } from '@/lib/run';
import { formatTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useSettingsButtonPlacement } from './SettingsButton';

export function Header() {
  const { state, worldRecord, timingMethod, comparison } = useLiveSplit();
  const { t } = useI18n();
  // Room for the settings button when it sits in the window's corner, over the header.
  const buttonInCorner = useSettingsButtonPlacement() === 'window';

  const run = state?.run;
  const lastSegment = run?.segments[run.segments.length - 1];
  const pb = pickTime(lastSegment?.personalBest, timingMethod);

  let wrContent: React.ReactNode = <span>{t('wr_display')}: -</span>;
  if (worldRecord.status === 'loading') {
    wrContent = <span>{t('wr_display')}: {t('wr_loading')}</span>;
  } else if (worldRecord.status === 'error') {
    wrContent = <span>{t('wr_display')}: {t('wr_error')}</span>;
  } else if (worldRecord.status === 'ok') {
    const record = worldRecord.record;
    const recordTime = formatTime(record?.timeMs ?? null);
    const players = record?.players.join(', ') ?? '';
    const tooltip = record
      ? `${t('tooltip_wr').replace('{0}', recordTime).replace('{1}', players)}${record.url ? `\n${t('tooltip_wr_click')}` : ''}`
      : undefined;
    wrContent = record ? (
      <a
        title={tooltip}
        href={record.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex min-w-0 items-center gap-1 transition-colors hover:text-accent"
      >
        <span className="truncate">
          {t('wr_display')}: {formatTime(record.timeMs)}
          {record.players.length > 0 && ` ${t('wr_by')} ${record.players.join(', ')}`}
        </span>
        <ExternalLink size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </a>
    ) : (
      <span>{t('wr_display')}: {t('wr_not_found')}</span>
    );
  }

  return (
    <header className="relative flex min-h-[70px] shrink-0 flex-col justify-center gap-1 border-b border-white/10 px-4 py-3">
      <div className={cn('flex min-w-0 items-center gap-3', buttonInCorner && 'pr-10')}>
        {run?.gameIcon && (
          // Data URL sent by LiveSplit; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.gameIcon} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
        )}
        <h1 className="min-w-0 truncate text-base font-semibold text-accent" title={run?.gameName}>
          {run?.gameName || '-'}
        </h1>
        <p className="min-w-0 max-w-[200px] shrink truncate font-mono text-[11px] tracking-[-0.2px] text-[var(--text-dim)]" title={run?.categoryName}>
          {run?.categoryName || '-'}
          {state && comparison !== PERSONAL_BEST && ` · ${t('comparison_vs')} ${comparison}`}
          {state && timingMethod === 'GameTime' && (
            <span className="ml-1.5 rounded border border-white/15 px-1 text-[9px] uppercase">IGT</span>
          )}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-4 font-mono text-[11px] tracking-[-0.2px] text-[var(--text-dim)]">
        <span className="shrink-0">
          {t('pb_display')}: {formatTime(pb)}
        </span>
        <span className="min-w-0">{wrContent}</span>
      </div>
    </header>
  );
}
