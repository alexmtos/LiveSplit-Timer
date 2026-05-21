'use client';

import React, { useRef, useEffect } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTimer, formatDelta } from '@/hooks/useTimer';

export function ComparisonGraph() {
  const { runData } = useLiveSplit();
  const { settings } = useSettings();
  const { time: currentTime } = useTimer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !runData?.run?.segments) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 15;
    const paddingTop = 20;
    const footerHeight = 28;
    const graphHeight = height - paddingTop - footerHeight - 5;
    const zeroY = paddingTop + graphHeight / 2;

    ctx.clearRect(0, 0, width, height);

    const segments = runData.run.segments;
    const currentIndex = runData.currentSplitIndex ?? -1;

    // Collect data points
    const dataPoints: { delta: number | null, isSkipped: boolean, isRealTime: boolean }[] = [];

    segments.forEach((seg, i) => {
      const pb = seg.comparisons?.['Personal Best']?.realTime;
      const act = seg.splitTime?.realTime;
      const isSkipped = i < currentIndex && typeof act !== 'number';

      if (typeof act === 'number' && typeof pb === 'number') {
        dataPoints.push({ delta: act - pb, isSkipped: false, isRealTime: false });
      } else if (isSkipped) {
        dataPoints.push({ delta: null, isSkipped: true, isRealTime: false });
      }
    });

    // Add real-time point
    if (runData.timerState === 'Running' || runData.timerState === 'Paused') {
       const currentSegment = segments[Math.max(0, currentIndex)];
       const pb = currentSegment?.comparisons?.['Personal Best']?.realTime;
       if (typeof pb === 'number') {
         dataPoints.push({ delta: currentTime - pb, isSkipped: false, isRealTime: true });
       }
    }

    if (dataPoints.length === 0) return;

    // Scaling
    const deltas = dataPoints.filter(p => p.delta !== null).map(p => p.delta as number);
    const maxDelta = deltas.length > 0 ? Math.max(...deltas.map(Math.abs), 1000) : 1000;
    const scale = graphHeight / (maxDelta * 2.5);

    const getX = (i: number) => padding + (i * (width - padding * 2)) / Math.max(dataPoints.length - 1, 1);
    const getY = (delta: number | null) => delta === null ? zeroY : zeroY - (delta * scale);

    // Draw background grid/zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, zeroY);
    ctx.lineTo(width - padding, zeroY);
    ctx.stroke();

    // Draw graph lines & areas
    ctx.lineWidth = 2;
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const p1 = dataPoints[i];
      const p2 = dataPoints[i+1];
      const x1 = getX(i);
      const x2 = getX(i+1);
      const y1 = getY(p1.delta);
      const y2 = getY(p2.delta);

      if (p2.delta !== null) {
        ctx.fillStyle = p2.delta < 0 ? 'rgba(64, 255, 64, 0.1)' : 'rgba(255, 64, 64, 0.1)';
        ctx.beginPath();
        ctx.moveTo(x1, zeroY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, zeroY);
        ctx.fill();

        ctx.strokeStyle = p2.delta < 0 ? '#40ff40' : '#ff4040';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#888';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw points & boxes
    dataPoints.forEach((p, i) => {
      if (p.delta === null) return;
      const x = getX(i);
      const y = getY(p.delta);

      // Point
      ctx.fillStyle = p.isRealTime ? '#fff' : (p.delta < 0 ? '#40ff40' : '#ff4040');
      ctx.beginPath();
      ctx.arc(x, y, p.isRealTime ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      if(p.isRealTime) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Final point or real-time point box
      if (i === dataPoints.length - 1) {
        const text = formatDelta(p.delta);
        ctx.font = 'bold 10px monospace';
        const metrics = ctx.measureText(text);
        const bw = metrics.width + 6;
        const bh = 14;
        const bx = Math.min(width - bw - 5, Math.max(5, x - bw / 2));
        const by = height - footerHeight;

        ctx.fillStyle = '#000';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = p.delta < 0 ? '#40ff40' : '#ff4040';
        if (p.isRealTime) ctx.strokeStyle = '#fff';
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.textAlign = 'center';
        ctx.fillText(text, bx + bw / 2, by + 11);
      }
    });

  }, [runData, settings.showGraph, currentTime]);

  if (!settings.showGraph) return null;

  return (
    <div className="h-40 shrink-0 border-b border-white/10 bg-black/30 p-2">
      <div className="relative h-full w-full overflow-hidden rounded-md border border-white/5 bg-black/40">
        <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />
      </div>
    </div>
  );
}
