'use client';

import { useCallback } from 'react';
import { useExportView } from '@/components/ExportView';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useI18n } from './useI18n';
import { safeFileName, toCsv } from '@/lib/csv';
import { comparisonTime, groupSegments, parseSegmentName, pickTime, segmentTime, splitDelta } from '@/lib/run';
import { formatDelta, formatTime } from '@/lib/time';

/** Local date and time for file names, e.g. 2026-10-01_21-05-09, so exports don't overwrite each other. */
function timestamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function download(href: string, fileName: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function useExport() {
  const { state, comparison, timingMethod } = useLiveSplit();
  const { t } = useI18n();
  const prepareExportView = useExportView();

  const baseName = state
    ? safeFileName(`${state.run.gameName} - ${state.run.categoryName}`.replace(/^ - | - $/g, ''))
    : 'run';

  const exportCSV = useCallback(() => {
    if (!state?.run.segments.length) return false;
    const segments = state.run.segments;
    const sectionOf = new Map<number, string>();
    for (const group of groupSegments(segments.map((seg) => seg.name))) {
      if (group.section) group.indices.forEach((i) => sectionOf.set(i, group.section as string));
    }

    const rows = [
      [t('csv_section'), t('csv_segment'), t('csv_split_time'), t('csv_segment_time'), comparison, t('csv_delta'), t('csv_best_segment')],
      ...segments.map((seg, i) => [
        sectionOf.get(i) ?? '',
        parseSegmentName(seg.name).display,
        formatTime(pickTime(seg.splitTime, timingMethod)),
        formatTime(segmentTime(segments, i, timingMethod)),
        formatTime(comparisonTime(seg, comparison, timingMethod)),
        formatDelta(splitDelta(seg, comparison, timingMethod)),
        formatTime(pickTime(seg.bestSegment, timingMethod)),
      ]),
    ];

    // BOM so Excel detects UTF-8; ";" is what Excel expects in pt-BR/most EU locales.
    const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    download(url, `${baseName} ${timestamp()}.csv`);
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return true;
  }, [state, comparison, timingMethod, t, baseName]);

  const exportImage = useCallback(async () => {
    if (!prepareExportView) return false;
    // A full-size copy of the overlay (every section open), rendered off screen just for the capture.
    const { element, done } = await prepareExportView();
    try {
      const { toPng } = await import('html-to-image');
      const background = getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim() || '#050505';
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: background,
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore !== undefined),
      });
      download(dataUrl, `${baseName} ${timestamp()}.png`);
      return true;
    } catch (error) {
      console.error('Error exporting image', error);
      return false;
    } finally {
      done();
    }
  }, [baseName, prepareExportView]);

  return { exportCSV, exportImage, canExport: !!state?.run.segments.length };
}
