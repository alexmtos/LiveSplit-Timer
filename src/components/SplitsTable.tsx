'use client';

import React, { useState } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { formatTime, formatDelta } from '@/hooks/useTimer';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function SplitsTable() {
  const { runData } = useLiveSplit();
  const { settings } = useSettings();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  if (!settings.showTable || !runData?.run?.segments) return null;

  const segments = runData.run.segments;
  const currentIndex = runData.currentSplitIndex ?? -1;

  // Logic for grouping sections
  const groupedSegments: { section: string | null; segments: (typeof segments[0] & { index: number })[] }[] = [];
  let currentSection: string | null = null;
  let currentGroup: (typeof segments[0] & { index: number })[] = [];

  segments.forEach((seg, i) => {
    const sectionMatch = seg.name.match(/\{([^}]*)\}/);
    const sectionName = sectionMatch ? sectionMatch[1] : null;

    if (sectionName && sectionName !== currentSection) {
       if (currentGroup.length > 0 || currentSection !== null) {
         groupedSegments.push({ section: currentSection, segments: currentGroup });
       }
       currentSection = sectionName;
       currentGroup = [];
    }

    currentGroup.push({ ...seg, index: i });
  });
  if (currentGroup.length > 0) {
    groupedSegments.push({ section: currentSection, segments: currentGroup });
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black/10 scrollbar-thin scrollbar-thumb-white/20">
      <table className="w-full border-collapse">
        <tbody>
          {groupedSegments.map((group, groupIdx) => {
            const isExpanded = group.section ? (settings.alwaysExpandedSplits || expandedSections.has(group.section)) : true;
            const hasActive = group.segments.some(s => s.index === currentIndex);
            const displayExpanded = isExpanded || hasActive;

            return (
              <React.Fragment key={groupIdx}>
                {group.section && (
                  <tr
                    onClick={() => group.section && toggleSection(group.section)}
                    className="h-8 cursor-pointer border-b border-white/5 bg-[var(--theme-accent)]/5 hover:bg-[var(--theme-accent)]/10 transition-colors"
                  >
                    <td colSpan={3} className="px-3">
                      <div className="flex items-center gap-2">
                        {displayExpanded ? <ChevronDown size={14} className="text-[var(--theme-accent)]" /> : <ChevronRight size={14} className="text-[var(--theme-accent)]" />}
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-accent)]">
                          {group.section}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {group.segments.map((seg) => {
                  const pb = seg.comparisons?.['Personal Best']?.realTime;
                  const act = seg.splitTime?.realTime;
                  const isActive = seg.index === currentIndex;
                  const isCompleted = typeof act === 'number';

                  if (group.section && !displayExpanded && !isActive) return null;

                  let delta = null;
                  let statusClass = 'text-[var(--text-dim)]';

                  if (isCompleted && typeof pb === 'number') {
                    delta = act - pb;
                    statusClass = delta < 0 ? 'text-green-500 font-bold' : (delta > 0 ? 'text-red-500 font-bold' : 'text-gray-400');
                  }

                  const displayName = seg.name.includes('{')
                    ? seg.name.split('}').pop()?.trim() || seg.name
                    : (seg.name.startsWith('-') ? seg.name.substring(1).trim() : seg.name);

                  return (
                    <tr
                      key={seg.index}
                      className={cn(
                        "h-[42px] border-b border-white/5 transition-colors hover:bg-white/5",
                        isActive && "bg-white/10"
                      )}
                    >
                      <td className="px-3 text-sm font-medium text-white max-w-[200px] truncate">
                        <span className={cn(
                          "transition-colors",
                          isActive && "text-[var(--theme-accent)]",
                          seg.name.startsWith('-') && "pl-4 text-[var(--text-dim)] text-xs"
                        )}>
                          {displayName}
                        </span>
                      </td>
                      <td className="px-3 text-right font-mono text-sm text-white">
                        {act ? formatTimeDisplay(act) : (pb ? formatTimeDisplay(pb) : '-')}
                      </td>
                      <td className={cn("px-3 text-right font-mono text-sm", statusClass)}>
                        {act ? formatDelta(delta) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatTimeDisplay(ms: number) {
  const f = formatTime(ms);
  return `${f.timePart}.${f.msPart}`;
}
