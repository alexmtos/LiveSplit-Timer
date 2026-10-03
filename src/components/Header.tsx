'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { useSpeedrunName } from '@/hooks/useSpeedrunName';
import { categoryExtras, extendedCategoryName } from '@/lib/category';
import { PERSONAL_BEST, pickTime } from '@/lib/run';
import { formatTime } from '@/lib/time';
import { FittedImage } from './FittedImage';
import { SettingsButton } from './SettingsButton';

export function Header() {
  const { state, worldRecord, timingMethod, comparison } = useLiveSplit();
  const { t } = useI18n();
  const { settings } = useSettings();

  const run = state?.run;
  const lastSegment = run?.segments[run.segments.length - 1];
  const pb = pickTime(lastSegment?.personalBest, timingMethod);
  const region = useSpeedrunName('regions', run?.metadata.regionId ?? null);
  const platform = useSpeedrunName('platforms', run?.metadata.platformId ?? null);
  // The category with LiveSplit's additional info (variables, region, platform), e.g. "Any% (Glitchless, NTSC, N64)".
  const category = run?.categoryName
    ? extendedCategoryName(run.categoryName, categoryExtras(run.metadata, { region, platform }, t('category_emulator')))
    : '-';

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
    <header className="group/host relative flex min-h-[70px] shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
      {run?.gameIcon && <FittedImage src={run.gameIcon} size={settings.gameIconSize} className="shrink-0 rounded" />}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <h1 className="truncate text-base font-semibold leading-tight text-accent" title={run?.gameName}>
          {run?.gameName || '-'}
        </h1>
        {/* The category, with its additional info, on a line of its own under the game. */}
        <p className="truncate font-mono text-[11px] tracking-[-0.2px] text-[var(--text-dim)]" title={category}>
          {category}
          {state && comparison !== PERSONAL_BEST && ` · ${t('comparison_vs')} ${comparison}`}
          {state && timingMethod === 'GameTime' && (
            <span className="ml-1.5 rounded border border-white/15 px-1 text-[9px] uppercase">IGT</span>
          )}
        </p>

        <div className="flex min-w-0 items-center gap-4 font-mono text-[11px] tracking-[-0.2px] text-[var(--text-dim)]">
          <span className="shrink-0">
            {t('pb_display')}: {formatTime(pb)}
          </span>
          <span className="min-w-0">{wrContent}</span>
        </div>
      </div>

      <SettingsButton at="header" layout="slide" className="-ml-3 group-hover/host:ml-0 focus-visible:ml-0" />
    </header>
  );
}
