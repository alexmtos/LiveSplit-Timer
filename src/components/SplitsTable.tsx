'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSplitSelection } from '@/contexts/SelectionContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { useRunClock } from '@/hooks/useRunClock';
import { SLOW_INTERVAL_MS } from '@/lib/ticker';
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
  time: number | null;
  delta: number | null;
  status: SplitStatus | null;
  isActive: boolean;
  isDone: boolean;
  isSkipped: boolean;
  isFuture: boolean;
}

function buildRow(state: LiveSplitState, index: number, comparison: string, method: TimingMethod): Row {
  const segments = state.run.segments;
  const seg = segments[index];
  const split = pickTime(seg.splitTime, method);
  const isDone = split !== null;
  const current = state.currentSplitIndex;
  // Before the current split without a time means it was skipped (also true for every split after the run ended).
  const isSkipped = !isDone && index < current;
  const running = state.timerState === 'Running' || state.timerState === 'Paused';
  return {
    index,
    name: parseSegmentName(seg.name).display,
    icon: seg.icon,
    // Splits without a time of their own show the comparison's, as before.
    time: isDone ? split : comparisonTime(seg, comparison, method),
    delta: isDone ? splitDelta(seg, comparison, method) : null,
    status: isDone ? splitStatus(segments, index, comparison, method) : null,
    isActive: index === current && running,
    isDone,
    isSkipped,
    isFuture: state.timerState === 'NotRunning' || index > current || (index === current && !running),
  };
}

/** Live delta on the current split; isolated so only this cell re-renders with the clock. */
function LiveDeltaCell({ state, comparison, method }: { state: LiveSplitState; comparison: string; method: TimingMethod }) {
  const { currentTime } = useRunClock(SLOW_INTERVAL_MS);
  const delta = liveDelta(state, currentTime, comparison, method);
  return <span className={deltaTextClass(delta)}>{formatDelta(delta)}</span>;
}

/** Scrolls `row` into the middle of `container` when it is out of view. */
function reveal(container: HTMLElement | null, row: HTMLElement | null | undefined) {
  if (!container || !row) return;
  const top = row.offsetTop;
  if (top < container.scrollTop || top + row.offsetHeight > container.scrollTop + container.clientHeight) {
    container.scrollTo({ top: Math.max(0, top - container.clientHeight / 2 + row.offsetHeight / 2), behavior: 'smooth' });
  }
}

/** Thin accent bar and glow at the top or bottom edge while the table can scroll that way. */
function ScrollHint({ edge, shown }: { edge: 'top' | 'bottom'; shown: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 z-10 h-8 from-accent/25 to-transparent transition-opacity duration-200',
        edge === 'top' ? 'top-0 border-t-2 border-accent/70 bg-gradient-to-b' : 'bottom-0 border-b-2 border-accent/70 bg-gradient-to-t',
        shown ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

/** `printable`: every section open and no scrolling, for the image export. */
export function SplitsTable({ printable = false }: { printable?: boolean }) {
  const { state, comparison, timingMethod } = useLiveSplit();
  const { settings } = useSettings();
  const { selected, toggle: toggleSelected } = useSplitSelection();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  // Whether there is more to scroll above and below.
  const [more, setMore] = useState({ up: false, down: false });
  const currentIndex = state?.currentSplitIndex ?? -1;
  // Sections opened by hand close again when the run moves to another split, like the original overlay.
  const [opened, setOpened] = useState<{ at: number; keys: ReadonlySet<string> }>({ at: -1, keys: new Set() });
  const openKeys = opened.at === currentIndex ? opened.keys : new Set<string>();

  const segmentCount = state?.run.segments.length ?? 0;

  // Keep the current split in view when it changes (not on every state refresh,
  // so scrolling by hand isn't undone every 15 seconds), unless a split is selected.
  useEffect(() => {
    if (selected !== null) return;
    const container = containerRef.current;
    reveal(container, container?.querySelector<HTMLElement>(`[data-split-index="${currentIndex}"]`));
  }, [currentIndex, segmentCount, selected]);

  const hasTable = !printable && (state?.run.segments.length ?? 0) > 1;
  const updateMore = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // A pixel of slack: zoomed pages scroll to fractional positions.
    const up = container.scrollTop > 1;
    const down = container.scrollTop + container.clientHeight < container.scrollHeight - 1;
    setMore((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
  }, []);

  // Also when the table or its content changes size (window resized, a section opened).
  useEffect(() => {
    if (!hasTable) return;
    const observer = new ResizeObserver(updateMore);
    if (containerRef.current) observer.observe(containerRef.current);
    if (tableRef.current) observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [hasTable, updateMore]);

  // A split selected here or on the graph is brought into view.
  useEffect(() => {
    if (selected === null) return;
    const container = containerRef.current;
    // Its section may only open on this render.
    const id = requestAnimationFrame(() =>
      reveal(container, container?.querySelector<HTMLElement>(`[data-split-index="${selected}"]`)),
    );
    return () => cancelAnimationFrame(id);
  }, [selected]);

  if (!state || state.run.segments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black/10 p-6 text-sm text-[var(--text-dim)]">
        {state ? t('no_splits') : t('waiting_data')}
      </div>
    );
  }
  // Like before, a run with a single split shows no table (nor graph).
  if (state.run.segments.length <= 1) return <div className="flex-1" />;

  const groups = groupSegments(state.run.segments.map((seg) => seg.name));
  const hasIcons = state.run.segments.some((seg) => seg.icon);
  const columns = hasIcons ? 4 : 3;

  const toggleSection = (key: string) => {
    setOpened((prev) => {
      const keys = new Set(prev.at === currentIndex ? prev.keys : []);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      return { at: currentIndex, keys };
    });
  };

  const renderRow = (row: Row) => {
    const canSelect = row.isDone || row.isSkipped || row.isActive;
    return (
      <tr
        key={row.index}
        data-split-index={row.index}
        onClick={canSelect ? () => toggleSelected(row.index) : undefined}
        aria-selected={selected === row.index}
        className={cn(
          'h-[42px] border-b border-white/[0.03] transition-all hover:bg-white/5',
          row.isActive && 'bg-white/10',
          canSelect ? 'cursor-pointer' : 'cursor-default',
          selected === row.index && 'shadow-[inset_0_0_0_2px_var(--theme-accent)]',
        )}
      >
        {hasIcons && (
          <td className="px-1">
            {row.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.icon} alt="" className="mx-auto block h-5 w-5 rounded-[3px] object-cover" />
            )}
          </td>
        )}
        <td className="pl-2.5 pr-3">
          <div
            className={cn('truncate', row.isFuture ? 'font-normal text-[var(--text-dim)]' : 'text-white', row.isSkipped && 'italic opacity-60')}
            title={row.isSkipped ? `${row.name} (${t('split_skipped')})` : row.name}
          >
            {row.name}
          </div>
        </td>
        <td className="whitespace-nowrap pr-3 text-right font-mono text-sm font-medium tabular-nums text-white">
          {formatTime(row.time)}
        </td>
        <td
          className={cn(
            'overflow-hidden whitespace-nowrap pr-[15px] text-right font-mono font-bold tabular-nums',
            row.status ? STATUS_TEXT_CLASS[row.status] : 'text-[var(--text-dim)]',
          )}
        >
          {row.isActive ? (
            <LiveDeltaCell state={state} comparison={comparison} method={timingMethod} />
          ) : row.isDone ? (
            formatDelta(row.delta)
          ) : (
            '-'
          )}
        </td>
      </tr>
    );
  };

  const table = (
    <table ref={tableRef} className="w-full table-fixed border-collapse">
      <colgroup>
        {hasIcons && <col className="w-8" />}
        <col />
        <col className="w-[100px]" />
        <col className="w-[90px]" />
      </colgroup>
      <tbody>
        {groups.map((group, groupIndex) => {
          const rows = group.indices.map((i) => buildRow(state, i, comparison, timingMethod));
          if (group.section === null) return rows.map(renderRow);

          const key = `${groupIndex}:${group.section}`;
          const containsActive = group.indices.includes(currentIndex);
          const containsSelected = selected !== null && group.indices.includes(selected);
          const expanded =
            printable || settings.alwaysExpandedSplits || containsActive || containsSelected || openKeys.has(key);
          const last = rows[rows.length - 1];

          return (
            <React.Fragment key={key}>
              <tr
                onClick={settings.alwaysExpandedSplits ? undefined : () => toggleSection(key)}
                className={cn(
                  'border-b border-accent/20 bg-accent/[0.08] transition-colors',
                  !settings.alwaysExpandedSplits && 'cursor-pointer hover:bg-accent/[0.12]',
                )}
                aria-expanded={expanded}
              >
                <td colSpan={columns - 2} className="py-2 pl-3 pr-3">
                  <div className="truncate font-semibold text-accent" title={group.section}>
                    {group.section}
                  </div>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-base font-bold tabular-nums text-[var(--text-dim)]">
                  {formatTime(last.time)}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap py-2 pr-[15px] text-right font-mono text-[0.95em] font-bold tabular-nums',
                    last.status ? STATUS_TEXT_CLASS[last.status] : 'text-[var(--text-dim)]',
                  )}
                >
                  {last.isDone ? formatDelta(last.delta) : '-'}
                </td>
              </tr>
              {expanded && rows.map(renderRow)}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  if (printable) return <div className="bg-black/10">{table}</div>;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-black/10">
      {/* `relative`: the rows' offsetTop, used by reveal(), is measured from here. */}
      <div ref={containerRef} onScroll={updateMore} className="splits-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {table}
      </div>
      <ScrollHint edge="top" shown={more.up} />
      <ScrollHint edge="bottom" shown={more.down} />
    </div>
  );
}
