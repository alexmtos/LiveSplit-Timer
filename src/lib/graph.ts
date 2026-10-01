import { isBestSegment, parseSegmentName, pickTime, splitDelta } from './run';
import type { LiveSplitState, TimingMethod } from '@/types';

/** One point of the comparison graph: a finished (or skipped) split, or the live position. */
export interface GraphPoint {
  /** Index of the split in the run. */
  split: number;
  /** Delta against the comparison; null when skipped or when the comparison has no time. */
  delta: number | null;
  /** Where the point is drawn: the delta, or for points without one, between their neighbours. */
  renderDelta: number;
  skipped: boolean;
  gold: boolean;
  live: boolean;
  /** Name of the section that ends at this split, if any. */
  section: string | null;
}

/** Points for the splits done so far (live point not included). */
export function buildGraphPoints(state: LiveSplitState, comparison: string, method: TimingMethod): GraphPoint[] {
  if (state.timerState === 'NotRunning') return [];
  const segments = state.run.segments;
  const done = Math.min(state.currentSplitIndex, segments.length);
  const points: GraphPoint[] = [];
  for (let i = 0; i < done; i++) {
    const skipped = pickTime(segments[i].splitTime, method) === null;
    const delta = skipped ? null : splitDelta(segments[i], comparison, method);
    points.push({
      split: i,
      delta,
      renderDelta: 0,
      skipped,
      gold: !skipped && isBestSegment(segments, i, method),
      live: false,
      section: parseSegmentName(segments[i].name).sectionName,
    });
  }
  return interpolate(points);
}

/** Adds the live point (current split) when there is a live delta. */
export function withLivePoint(points: GraphPoint[], state: LiveSplitState, live: number | null): GraphPoint[] {
  if (live === null || state.currentSplitIndex < 0 || state.currentSplitIndex >= state.run.segments.length) return points;
  return [
    ...points,
    { split: state.currentSplitIndex, delta: live, renderDelta: live, skipped: false, gold: false, live: true, section: null },
  ];
}

/** Points without a delta sit halfway between the nearest points that have one. */
function interpolate(points: GraphPoint[]): GraphPoint[] {
  return points.map((point, i) => {
    if (point.delta !== null) return { ...point, renderDelta: point.delta };
    let previous: number | null = null;
    for (let j = i - 1; j >= 0 && previous === null; j--) previous = points[j].delta;
    let next: number | null = null;
    for (let j = i + 1; j < points.length && next === null; j++) next = points[j].delta;
    const renderDelta = previous !== null && next !== null ? (previous + next) / 2 : previous ?? next ?? 0;
    return { ...point, renderDelta };
  });
}

/** Half the height of the graph in milliseconds: the largest delta plus 25 % headroom. */
export function graphRange(points: GraphPoint[]): number {
  let largest = 0;
  for (const point of points) if (point.delta !== null) largest = Math.max(largest, Math.abs(point.delta));
  return Math.max(largest * 1.25, 1);
}

/**
 * Points that get a delta label under the graph: first, last, current, best,
 * worst, and every section end.
 */
export function labelledPoints(points: GraphPoint[]): { index: number; isActive: boolean }[] {
  if (points.length === 0) return [];
  const active = points.length - 1;
  let best = -1;
  let worst = -1;
  points.forEach((point, i) => {
    if (point.delta === null) return;
    if (best === -1 || point.delta <= (points[best].delta as number)) best = i;
    if (worst === -1 || point.delta >= (points[worst].delta as number)) worst = i;
  });
  const indices = new Set([0, active, best, worst].filter((i) => i >= 0));
  points.forEach((point, i) => point.section && indices.add(i));
  // The current point is drawn last so its label stays on top.
  return [...indices]
    .sort((a, b) => (a === active ? 1 : b === active ? -1 : a - b))
    .map((index) => ({ index, isActive: index === active }));
}
