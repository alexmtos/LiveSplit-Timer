import { describe, expect, it } from 'vitest';
import { buildGraphPoints, graphRange, labelledPoints, withLivePoint } from '@/lib/graph';
import { segment, state } from './fixtures';

const run = [
  segment('-1-1', { split: 9_000, pb: 10_000, best: 9_500 }),
  segment('{World 1}Boss', { split: null, pb: 20_000, best: 9_000 }),
  segment('-2-1', { split: 33_000, pb: 30_000, best: 9_000 }),
  segment('Final', { split: null, pb: 40_000, best: 9_000 }),
];

describe('buildGraphPoints', () => {
  it('has a point per split done, none before the start', () => {
    expect(buildGraphPoints(state(run, { phase: 'NotRunning', index: -1 }), 'Personal Best', 'RealTime')).toEqual([]);
    const points = buildGraphPoints(state(run, { index: 3 }), 'Personal Best', 'RealTime');
    expect(points.map((p) => p.split)).toEqual([0, 1, 2]);
    expect(points.map((p) => p.delta)).toEqual([-1_000, null, 3_000]);
  });

  it('marks skipped splits, places them between their neighbours and names section ends', () => {
    const [first, skipped, third] = buildGraphPoints(state(run, { index: 3 }), 'Personal Best', 'RealTime');
    expect(skipped.skipped).toBe(true);
    expect(skipped.renderDelta).toBe(1_000);
    expect(skipped.section).toBe('World 1');
    expect(first.gold).toBe(true);
    expect(third.gold).toBe(false);
  });

  it('adds the live point only when there is a live delta', () => {
    const current = state(run, { index: 3 });
    const points = buildGraphPoints(current, 'Personal Best', 'RealTime');
    expect(withLivePoint(points, current, null)).toBe(points);
    const live = withLivePoint(points, current, 5_000);
    expect(live).toHaveLength(4);
    expect(live[3]).toMatchObject({ split: 3, delta: 5_000, live: true });
  });
});

describe('graph scale and labels', () => {
  it('leaves 25 % headroom over the largest delta', () => {
    const points = buildGraphPoints(state(run, { index: 3 }), 'Personal Best', 'RealTime');
    expect(graphRange(points)).toBe(3_750);
    expect(graphRange([])).toBe(1);
  });

  it('labels first, last, best, worst and section ends, with the current one last', () => {
    const points = buildGraphPoints(state(run, { index: 3 }), 'Personal Best', 'RealTime');
    const labels = labelledPoints(points);
    expect(labels.map((l) => l.index).sort()).toEqual([0, 1, 2]);
    expect(labels[labels.length - 1]).toEqual({ index: 2, isActive: true });
  });
});
