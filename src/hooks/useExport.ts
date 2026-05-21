'use client';

import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { formatTime, formatDelta } from '@/hooks/useTimer';
import { toPng } from 'html-to-image';

export function useExport() {
  const { runData } = useLiveSplit();

  const exportCSV = () => {
    if (!runData?.run?.segments) return;

    const headers = ['Nome', 'Tempo PB', 'Tempo Atual', 'Delta'];
    const rows = runData.run.segments.map(seg => {
      const pb = seg.comparisons?.['Personal Best']?.realTime;
      const act = seg.splitTime?.realTime;

      const pbF = pb ? `${formatTime(pb).timePart}.${formatTime(pb).msPart}` : '-';
      const actF = act ? `${formatTime(act).timePart}.${formatTime(act).msPart}` : '-';
      const delta = (pb && act) ? formatDelta(act - pb) : '-';

      return [seg.name, pbF, actF, delta].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `livesplit_${runData.gameName || 'run'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportImage = async () => {
    const el = document.getElementById('ls-window');
    if (!el) return;

    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#050505',
        style: {
           borderRadius: '0px'
        }
      });
      const link = document.createElement('a');
      link.download = `livesplit_${runData?.gameName || 'run'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting image', err);
    }
  };

  return { exportCSV, exportImage };
}
