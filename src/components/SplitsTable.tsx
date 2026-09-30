'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { useRunClock } from '@/hooks/useRunClock';
import { STATUS_TEXT_CLASS, deltaTextClass } from '@/lib/colors';
import {
  comparisonTime,
  groupSegments,
  liveDelta,
  parseSegmentName,
  pickTime,
  splitDelta,
  splitStatus,
  type SplitStatus,
} from '@/lib/run';
import { formatDelta, formatTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { LiveSplitState, TimingMethod } from '@/types';

interface Row {
  index: number;
  name: string;
  icon: string | null;
  isSubsplit: boolean;
  time: number | null;
  delta: number | null;
  status: SplitStatus | null;
  isActive: boolean;
  isDone: boolean;
  isSkipped: boolean;
}

function buildRow(state: LiveSplitState, index: number, comparison: string, method: TimingMethod): Row {
  const segments = state.run.segments;
  const seg = segments[index];
  const parsed = parseSegmentName(seg.name);
  const split = pickTime(seg.splitTime, method);
  const isDone = split !== null;
  // Before the current split without a time means it was skipped (also true for every split after the run ended).
  const isSkipped = !isDone && index < state.currentSplitIndex;
  return {
    index,
    name: parsed.display,
    icon: seg.icon,
    isSubsplit: parsed.isSubsplit,
    time: isDone ? split : isSkipped ? null : comparisonTime(seg, comparison, method),
    delta: isDone ? splitDelta(seg, comparison, method) : null,
    status: isDone ? splitStatus(segments, index, comparison, method) : null,
    isActive: index === state.currentSplitIndex && (state.timerState === 'Running' || state.timerState === 'Paused'),
    isDone,
    isSkipped,
  };
}

/** Live delta on the current split; isolated so only this cell re-renders with the clock. */
function LiveDeltaCell({ state, comparison, method }: { state: LiveSplitState; comparison: string; method: TimingMethod }) {
  const { currentTime } = useRunClock(100);
  const delta = liveDelta(state, currentTime, comparison, method);
  return <span className={deltaTextClass(delta)}>{delta === null ? '' : formatDelta(delta)}</span>;
}

export function SplitsTable() {
  const { state, comparison, timingMethod } = useLiveSplit();
  const { settings } = useSettings();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndex = state?.currentSplitIndex ?? -1;
  // Sections opened by hand close again when the run moves to another split, like the original overlay.
  const [opened, setOpened] = useState<{ at: number; keys: ReadonlySet<string> }>({ at: -1, keys: new Set() });
  const openKeys = opened.at === currentIndex ? opened.keys : new Set<string>();

  const segmentCount = state?.run.segments.length ?? 0;

  // Keep the current split in view when it changes (not on every state refresh,
  // so scrolling by hand isn't undone every 15 seconds).
  useEffect(() => {
    const container = containerRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-split-index="${currentIndex}"]`);
    if (!container || !row) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    if (rowTop < container.scrollTop || rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: Math.max(0, rowTop - container.clientHeight / 2 + row.offsetHeight / 2), behavior: 'smooth' });
    }
  }, [currentIndex, segmentCount, settings.showTable]);

  if (!settings.showTable) return null;

  if (!state || state.run.segments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black/10 p-6 text-sm text-[var(--text-dim)]">
        {state ? t('no_splits') : t('waiting_data')}
      </div>
    );
  }

  const groups = groupSegments(state.run.segments.map((seg) => seg.name));
  const hasIcons = state.run.segments.some((seg) => seg.icon);
  const columns = hasIcons ? 4 : 3;

  const toggle = (key: string) => {
    setOpened((prev) => {
      const keys = new Set(prev.at === currentIndex ? prev.keys : []);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      return { at: currentIndex, keys };
    });
  };

  const renderRow = (row: Row) => (
    <tr
      key={row.index}
      data-split-index={row.index}
      className={cn('h-[42px] border-b border-white/5 transition-colors hover:bg-white/5', row.isActive && 'bg-white/10')}
    >
      {hasIcons && (
        <td className="pl-3">
          {row.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.icon} alt="" className="h-6 w-6 object-contain" />
          )}
        </td>
      )}
      <td className="px-3 text-sm font-medium text-white">
        <div
          className={cn(
            'truncate',
            row.isActive && 'text-[var(--theme-accent)]',
            row.isSubsplit && 'pl-4 text-xs',
            row.isSubsplit && !row.isActive && 'text-[var(--text-dim)]',
            row.isSkipped && 'italic opacity-60',
          )}
          title={row.isSkipped ? `${row.name} (${t('split_skipped')})` : row.name}
        >
          {row.name}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 text-right font-mono text-sm tabular-nums text-white">
        {formatTime(row.time)}
      </td>
      <td
        className={cn(
          'whitespace-nowrap px-3 text-right font-mono text-sm font-bold tabular-nums',
          row.status ? STATUS_TEXT_CLASS[row.status] : 'text-[var(--text-dim)]',
        )}
      >
        {row.isActive ? (
          <LiveDeltaCell state={state} comparison={comparison} method={timingMethod} />
        ) : row.isDone ? (
          formatDelta(row.delta)
        ) : (
          ''
        )}
      </td>
    </tr>
  );

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto bg-black/10">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {hasIcons && <col className="w-9" />}
          <col />
          <col className="w-28" />
          <col className="w-[5.5rem]" />
        </colgroup>
        <tbody>
          {groups.map((group, groupIndex) => {
            const rows = group.indices.map((i) => buildRow(state, i, comparison, timingMethod));
            if (group.section === null) return rows.map(renderRow);

            const key = `${groupIndex}:${group.section}`;
            const containsActive = group.indices.includes(currentIndex);
            const expanded = settings.alwaysExpandedSplits || containsActive || openKeys.has(key);
            const last = rows[rows.length - 1];

            return (
              <React.Fragment key={key}>
                <tr
                  onClick={settings.alwaysExpandedSplits ? undefined : () => toggle(key)}
                  className={cn(
                    'h-8 border-b border-white/5 bg-[var(--theme-accent)]/5 transition-colors',
                    !settings.alwaysExpandedSplits && 'cursor-pointer hover:bg-[var(--theme-accent)]/10',
                  )}
                  aria-expanded={expanded}
                >
                  <td colSpan={columns - 2} className="px-3">
                    <div className="flex items-center gap-2">
                      {expanded ? (
                        <ChevronDown size={14} className="shrink-0 text-[var(--theme-accent)]" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0 text-[var(--theme-accent)]" />
                      )}
                      <span className="truncate text-xs font-bold uppercase tracking-wider text-[var(--theme-accent)]">
                        {group.section}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 text-right font-mono text-xs tabular-nums text-white/80">
                    {formatTime(last.time)}
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-3 text-right font-mono text-xs font-bold tabular-nums',
                      last.status ? STATUS_TEXT_CLASS[last.status] : 'text-[var(--text-dim)]',
                    )}
                  >
                    {last.isDone ? formatDelta(last.delta) : ''}
                  </td>
                </tr>
                {expanded && rows.map(renderRow)}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
