'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSplitSelection } from '@/contexts/SelectionContext';
import { useI18n } from '@/hooks/useI18n';
import { AHEAD_HEX, BEHIND_HEX, STATUS_HEX } from '@/lib/colors';
import { buildGraphPoints, graphRange, labelledPoints, withLivePoint, type GraphPoint } from '@/lib/graph';
import { extrapolateTime, liveDelta } from '@/lib/run';
import { formatDelta } from '@/lib/time';
import { cn } from '@/lib/utils';

const HEIGHT_KEY = 'ls_graph_height';
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 213;
/** How close (px) a click must be to a point to select it. */
const CLICK_RADIUS = 15;
const MONO = "Consolas, 'Courier New', monospace";
const GREY = '#888';
const SECTION_COLORS = ['rgba(0, 162, 255, 0.6)', 'rgba(255, 184, 0, 0.6)', 'rgba(64, 255, 64, 0.6)'];
const PADDING_TOP = 20;
const PADDING_SIDES = 15;
const FOOTER = 28;

interface Layout {
  points: GraphPoint[];
  x: (index: number) => number;
  y: (delta: number) => number;
}

const signColor = (delta: number | null, fallback = GREY) =>
  delta === null ? fallback : delta < 0 ? AHEAD_HEX : delta > 0 ? BEHIND_HEX : fallback;

function drawGraph(canvas: HTMLCanvasElement, width: number, height: number, points: GraphPoint[], selected: number | null): Layout {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const graphHeight = height - PADDING_TOP - FOOTER - 5;
  const graphBottom = PADDING_TOP + graphHeight;
  const range = graphRange(points);
  const y = (delta: number) => PADDING_TOP + graphHeight * (1 - Math.max(0, Math.min(1, (delta + range) / (2 * range))));
  const step = points.length <= 1 ? 0 : (width - PADDING_SIDES * 2) / (points.length - 1);
  const x = (index: number) => PADDING_SIDES + index * step;
  const zeroY = y(0);
  const active = points.length - 1;
  const neutral = (p: GraphPoint) => p.delta === null || p.skipped;

  // Area between the line and zero.
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    ctx.fillStyle = neutral(b) || b.delta === 0
      ? 'rgba(136, 136, 136, 0.12)'
      : (b.delta as number) < 0 ? 'rgba(64, 255, 64, 0.12)' : 'rgba(255, 64, 64, 0.12)';
    ctx.beginPath();
    ctx.moveTo(x(i), zeroY);
    ctx.lineTo(x(i), y(a.renderDelta));
    ctx.lineTo(x(i + 1), y(b.renderDelta));
    ctx.lineTo(x(i + 1), zeroY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING_SIDES, zeroY);
  ctx.lineTo(width - PADDING_SIDES, zeroY);
  ctx.stroke();

  // Section ends: dashed marker with the section name on top.
  let sectionCount = 0;
  points.forEach((point, i) => {
    if (!point.section) return;
    const color = SECTION_COLORS[sectionCount++ % SECTION_COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(x(i), PADDING_TOP - 5);
    ctx.lineTo(x(i), graphBottom + 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let text = point.section.toUpperCase();
    if (ctx.measureText(text).width > width - 10) {
      while (text.length > 3 && ctx.measureText(`${text}...`).width > width - 10) text = text.slice(0, -1);
      text += '...';
    }
    const half = ctx.measureText(text).width / 2;
    ctx.fillText(text, Math.max(half + 5, Math.min(width - half - 5, x(i))), PADDING_TOP - 8);
  });

  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const grey = neutral(a) || neutral(b);
    ctx.strokeStyle = grey ? GREY : signColor(b.delta);
    ctx.lineWidth = grey ? 2.5 : 3;
    ctx.beginPath();
    ctx.moveTo(x(i), y(a.renderDelta));
    ctx.lineTo(x(i + 1), y(b.renderDelta));
    ctx.stroke();
  }

  const labels = labelledPoints(points);
  const labelled = new Set(labels.map((label) => label.index));
  points.forEach((point, i) => {
    const px = x(i);
    const py = y(point.renderDelta);
    const isActive = i === active;
    const radius = point.live ? 6 : isActive ? 5 : 3;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    if (neutral(point)) {
      ctx.strokeStyle = point.live || isActive ? '#fff' : GREY;
      ctx.lineWidth = point.live ? 3 : isActive ? 2 : 1;
      ctx.stroke();
      if (point.skipped) {
        ctx.beginPath();
        ctx.moveTo(px - 4, py - 4);
        ctx.lineTo(px + 4, py + 4);
        ctx.moveTo(px + 4, py - 4);
        ctx.lineTo(px - 4, py + 4);
        ctx.strokeStyle = BEHIND_HEX;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      return;
    }
    const color = point.gold ? STATUS_HEX.gold : signColor(point.delta);
    ctx.fillStyle = color;
    ctx.fill();
    if (point.live) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (labelled.has(i)) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.stroke();
    }
  });

  // Delta labels under the graph, joined to their point by a dashed guide.
  for (const { index, isActive } of labels) {
    const point = points[index];
    const px = x(index);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, y(point.renderDelta) + 5);
    ctx.lineTo(px, height - FOOTER);
    ctx.stroke();
    ctx.setLineDash([]);

    const text = formatDelta(point.delta);
    const long = text.length > 8;
    ctx.font = isActive ? `bold ${long ? 9 : 11}px ${MONO}` : `${long ? 8 : 10}px ${MONO}`;
    const boxWidth = ctx.measureText(text).width + 6;
    const boxHeight = 16;
    const bx = Math.max(5, Math.min(width - boxWidth - 5, px - boxWidth / 2));
    const by = height - FOOTER;
    const color = isActive ? '#fff' : signColor(point.delta, GREY);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx, by, boxWidth, boxHeight);
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 1.5 : 1;
    ctx.strokeRect(bx, by, boxWidth, boxHeight);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + boxWidth / 2, by + boxHeight / 2 + 1);
  }

  // Selected split: ring and a tooltip with its delta.
  const selectedIndex = selected === null ? -1 : points.findIndex((p) => p.split === selected && !p.live);
  if (selectedIndex >= 0) {
    const point = points[selectedIndex];
    const px = x(selectedIndex);
    const py = y(point.renderDelta);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    if (!neutral(point)) {
      ctx.fillStyle = (point.delta as number) <= 0 ? AHEAD_HEX : BEHIND_HEX;
      ctx.fill();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const text = formatDelta(point.delta);
    ctx.font = `bold 12px ${MONO}`;
    const boxWidth = ctx.measureText(text).width + 8;
    const boxHeight = 18;
    const bx = Math.max(5, Math.min(width - boxWidth - 5, px - boxWidth / 2));
    const by = py - 25;
    ctx.fillStyle = '#000';
    ctx.fillRect(bx, by, boxWidth, boxHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxWidth, boxHeight);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + boxWidth / 2, by + boxHeight / 2 + 1);
  }

  return { points, x, y };
}

const clampHeight = (value: number) => Math.round(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, value)));

/**
 * `fill`: the graph is alone on the page (`/graph`) and takes all the space.
 * `fixedHeight`: a set height without the resize handle (image export).
 */
export function ComparisonGraph({ fill = false, fixedHeight }: { fill?: boolean; fixedHeight?: number }) {
  const { state, anchor, comparison, timingMethod } = useLiveSplit();
  const { selected, toggle } = useSplitSelection();
  const { t } = useI18n();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<Layout | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  // The saved height is read after mount; animate height changes only after that.
  const [heightLoaded, setHeightLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(HEIGHT_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after mount
      if (saved >= MIN_HEIGHT && saved <= MAX_HEIGHT) setHeight(saved);
    } catch {
      // Storage unavailable: keep the default height.
    }
    setHeightLoaded(true);
  }, []);

  const hidden = !state || state.run.segments.length <= 1;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [hidden]);

  const points = useMemo(() => (state ? buildGraphPoints(state, comparison, timingMethod) : []), [state, comparison, timingMethod]);

  // Drawn outside React: while the timer runs the live point moves every frame
  // without re-rendering anything, and the canvas is only redrawn when it changed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state || size.width === 0 || size.height === 0) return;
    let frame = 0;
    let drawn: string | undefined;
    const baseRange = graphRange(points);
    const plotHeight = Math.max(1, size.height - PADDING_TOP - FOOTER - 5);
    const render = () => {
      const currentTime = anchor ? extrapolateTime(anchor, timingMethod, performance.now()) : null;
      const live = liveDelta(state, currentTime, comparison, timingMethod);
      // Redraw only when the picture changes: the live point moved half a pixel,
      // the scale changed enough to move the other points, or its label changed.
      let key = 'static';
      if (live !== null) {
        const range = Math.max(baseRange, Math.abs(live) * 1.25);
        key = `${Math.round((live / (2 * range)) * plotHeight * 2)}|${Math.round(Math.log(range) * 500)}|${formatDelta(live)}`;
      }
      if (key !== drawn) {
        drawn = key;
        layoutRef.current = drawGraph(canvas, size.width, size.height, withLivePoint(points, state, live), selected);
      }
      if (state.timerState === 'Running') frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [state, anchor, comparison, timingMethod, points, size, selected]);

  if (hidden) return null;

  const onClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const layout = layoutRef.current;
    if (!layout) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    let closest = -1;
    let closestDistance = CLICK_RADIUS;
    layout.points.forEach((point, i) => {
      if (point.live) return;
      const distance = Math.hypot(cx - layout.x(i), cy - layout.y(point.renderDelta));
      if (distance < closestDistance) {
        closest = i;
        closestDistance = distance;
      }
    });
    if (closest >= 0) toggle(layout.points[closest].split);
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: height };
    setDragging(true);
  };
  const heightAt = (event: React.PointerEvent<HTMLDivElement>, start: { startY: number; startHeight: number }) =>
    clampHeight(start.startHeight + event.clientY - start.startY);
  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) setHeight(heightAt(event, drag.current));
  };
  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // From the release position: the last move may not have been rendered yet.
    // A cancelled drag has no meaningful position, so it keeps the last height.
    const finalHeight = event.type === 'pointercancel' ? height : heightAt(event, drag.current);
    drag.current = null;
    setHeight(finalHeight);
    setDragging(false);
    try {
      localStorage.setItem(HEIGHT_KEY, String(finalHeight));
    } catch {
      // Not saved; the height still applies until the page reloads.
    }
  };

  return (
    <div className={cn('shrink-0 border-b border-white/10 px-4 py-3', fill && 'flex flex-1 flex-col border-b-0')}>
      <div
        ref={wrapperRef}
        data-graph
        className={cn(
          'relative overflow-hidden rounded-lg border border-white/10 bg-black/30',
          fill ? 'flex-1' : 'min-h-[80px]',
          !fill && heightLoaded && !dragging && !fixedHeight && 'transition-[height] duration-300',
        )}
        style={fill ? undefined : { height: fixedHeight ?? height }}
      >
        <canvas ref={canvasRef} onClick={onClick} className="absolute inset-0 h-full w-full cursor-pointer select-none" aria-hidden />
        {!fill && !fixedHeight && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('tooltip_adjust_graph')}
            title={t('tooltip_adjust_graph')}
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            data-export-ignore
            className={cn(
              'group absolute inset-x-0 bottom-0 z-10 flex h-5 cursor-ns-resize touch-none items-center justify-center',
              dragging ? 'bg-gradient-to-b from-transparent to-accent/20' : 'hover:bg-gradient-to-b hover:from-transparent hover:to-accent/10',
            )}
          >
            <div
              className={cn(
                'h-1 w-[120px] rounded-sm transition-all',
                dragging ? 'bg-accent opacity-100' : 'bg-white/20 opacity-0 group-hover:bg-white/40 group-hover:opacity-100',
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
