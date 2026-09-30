'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunClock } from '@/hooks/useRunClock';
import { STATUS_HEX } from '@/lib/colors';
import { liveDelta, splitDelta, splitStatus } from '@/lib/run';
import { formatDelta } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { LiveSplitState, TimingMethod } from '@/types';

interface GraphPoint {
  delta: number;
  color: string;
  isLive?: boolean;
  /** Splits without a delta (skipped) sit between this point and the previous one. */
  afterGap?: boolean;
}

function buildPoints(state: LiveSplitState, currentTime: number | null, comparison: string, method: TimingMethod) {
  if (state.timerState === 'NotRunning') return [];
  const segments = state.run.segments;
  const points: GraphPoint[] = [{ delta: 0, color: STATUS_HEX.neutral }];
  let gap = false;
  for (let i = 0; i < Math.min(state.currentSplitIndex, segments.length); i++) {
    const delta = splitDelta(segments[i], comparison, method);
    if (delta === null) {
      gap = true;
      continue;
    }
    points.push({ delta, color: STATUS_HEX[splitStatus(segments, i, comparison, method)], afterGap: gap });
    gap = false;
  }
  const live = liveDelta(state, currentTime, comparison, method);
  if (live !== null) points.push({ delta: live, color: '#ffffff', isLive: true, afterGap: gap });
  return points;
}

const AHEAD = '#22c55e';
const BEHIND = '#ef4444';

function draw(canvas: HTMLCanvasElement, width: number, height: number, points: GraphPoint[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padding = 15;
  const paddingTop = 12;
  const footerHeight = 22;
  const graphHeight = height - paddingTop - footerHeight;
  const zeroY = paddingTop + graphHeight / 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, zeroY);
  ctx.lineTo(width - padding, zeroY);
  ctx.stroke();

  if (points.length < 2) return;

  const maxDelta = Math.max(1000, ...points.map((p) => Math.abs(p.delta)));
  const scale = (graphHeight / 2 - 6) / maxDelta;
  const x = (i: number) => padding + (i * (width - padding * 2)) / (points.length - 1);
  // Time lost goes up, time saved goes down (same orientation as before).
  const y = (delta: number) => zeroY - delta * scale;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    ctx.fillStyle = b.delta <= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
    ctx.beginPath();
    ctx.moveTo(x(i - 1), zeroY);
    ctx.lineTo(x(i - 1), y(a.delta));
    ctx.lineTo(x(i), y(b.delta));
    ctx.lineTo(x(i), zeroY);
    ctx.fill();

    ctx.strokeStyle = b.isLive ? 'rgba(255,255,255,0.7)' : b.delta <= 0 ? AHEAD : BEHIND;
    ctx.lineWidth = 2;
    ctx.setLineDash(b.afterGap || b.isLive ? [3, 3] : []);
    ctx.beginPath();
    ctx.moveTo(x(i - 1), y(a.delta));
    ctx.lineTo(x(i), y(b.delta));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  points.forEach((p, i) => {
    if (i === 0) return;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x(i), y(p.delta), p.isLive ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (p.isLive) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x(i), y(p.delta), 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  const last = points[points.length - 1];
  const text = formatDelta(last.delta);
  ctx.font = 'bold 10px ui-monospace, monospace';
  const boxWidth = ctx.measureText(text).width + 8;
  const boxHeight = 14;
  const boxX = Math.min(width - boxWidth - 5, Math.max(5, x(points.length - 1) - boxWidth / 2));
  const boxY = height - footerHeight + 4;
  const color = last.isLive ? '#ffffff' : last.color;
  ctx.fillStyle = '#000';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = color;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + boxWidth / 2, boxY + boxHeight / 2 + 0.5);
}

/** `fill`: the graph is alone on the page (`/graph`) and takes all the space. */
export function ComparisonGraph({ fill = false }: { fill?: boolean }) {
  const { state, comparison, timingMethod } = useLiveSplit();
  // 10 fps is plenty for the live point and keeps the canvas work cheap.
  const { currentTime } = useRunClock(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const points = state ? buildPoints(state, currentTime, comparison, timingMethod) : [];
  const signature = JSON.stringify(points);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    draw(canvas, size.width, size.height, JSON.parse(signature) as GraphPoint[]);
  }, [signature, size]);

  return (
    <div className={cn('shrink-0 border-b border-white/10 bg-black/30 p-2', fill ? 'flex-1 border-b-0' : 'h-40')}>
      <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-md border border-white/5 bg-black/40">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      </div>
    </div>
  );
}
