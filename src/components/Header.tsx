'use client';

import React from 'react';
import { ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useI18n } from '@/hooks/useI18n';
import { PERSONAL_BEST, pickTime } from '@/lib/run';
import { formatTime } from '@/lib/time';

export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state, worldRecord, timingMethod, comparison, isConnected } = useLiveSplit();
  const { t } = useI18n();

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
    wrContent = record ? (
      <a
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
    <header className="relative flex min-h-[70px] shrink-0 flex-col gap-1 border-b border-white/10 bg-black/30 p-3 px-4">
      <div className="absolute right-4 top-3" data-export-ignore>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onOpenSettings}
          aria-label={t('btn_settings')}
          title={t('btn_settings')}
          className="relative flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--text-dim)] transition-all hover:border-accent hover:bg-accent/10 hover:text-accent"
        >
          <SettingsIcon size={16} />
          {!isConnected && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black bg-red-500" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex items-center gap-3 pr-10">
        {run?.gameIcon && (
          // Data URL sent by LiveSplit; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.gameIcon} alt="" className="h-9 w-9 shrink-0 rounded object-contain" />
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-base font-bold leading-tight text-accent" title={run?.gameName}>
            {run?.gameName || '-'}
          </h1>
          <p className="truncate font-mono text-[11px] tracking-tight text-[var(--text-dim)]" title={run?.categoryName}>
            {run?.categoryName || '-'}
            {state && comparison !== PERSONAL_BEST && ` · ${t('comparison_vs')} ${comparison}`}
            {state && timingMethod === 'GameTime' && (
              <span className="ml-1.5 rounded border border-white/15 px-1 text-[9px] uppercase">IGT</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-4 font-mono text-[11px] tracking-tight text-[var(--text-dim)]">
        <span className="shrink-0">
          {t('pb_display')}: {formatTime(pb)}
        </span>
        <span className="min-w-0">{wrContent}</span>
      </div>
    </header>
  );
}
