import { describe, expect, it } from 'vitest';
import {
  bestPossibleTime,
  currentDelta,
  currentPace,
  displayTime,
  extrapolateTime,
  groupSegments,
  liveDelta,
  parseSegmentName,
  resolveComparison,
  splitStatus,
} from '@/lib/run';
import { segment, state } from './fixtures';

// PB: 10s, 25s, 45s. Best segments: 9s, 14s, 18s (sum of best 41s).
const pbRun = () => [
  segment('A', { pb: 10_000, best: 9_000 }),
  segment('B', { pb: 25_000, best: 14_000 }),
  segment('C', { pb: 45_000, best: 18_000 }),
];

describe('clock extrapolation', () => {
  const anchor = { phase: 'Running' as const, time: { realTime: 10_000, gameTime: 8_000 }, isGameTimePaused: false, receivedAt: 1_000 };

  it('advances while running', () => {
    expect(extrapolateTime(anchor, 'RealTime', 1_500)).toBe(10_500);
    expect(extrapolateTime(anchor, 'GameTime', 1_500)).toBe(8_500);
  });

  it('freezes when paused or while game time is paused (loads)', () => {
    expect(extrapolateTime({ ...anchor, phase: 'Paused' }, 'RealTime', 5_000)).toBe(10_000);
    expect(extrapolateTime({ ...anchor, isGameTimePaused: true }, 'GameTime', 5_000)).toBe(8_000);
    expect(extrapolateTime({ ...anchor, isGameTimePaused: true }, 'RealTime', 5_000)).toBe(14_000);
  });

  it('falls back to real time on the big timer when game time is missing', () => {
    const noGameTime = { ...anchor, time: { realTime: 10_000, gameTime: null } };
    expect(extrapolateTime(noGameTime, 'GameTime', 1_500)).toBeNull();
    expect(displayTime(noGameTime, 'GameTime', 1_500)).toBe(10_500);
    expect(displayTime(null, 'RealTime', 1_500)).toBe(0);
  });
});

describe('liveDelta (LiveSplit CheckLiveDelta)', () => {
  it('is hidden while ahead and gaining time', () => {
    const s = state(pbRun(), { index: 0 });
    expect(liveDelta(s, 5_000, 'Personal Best', 'RealTime')).toBeNull();
  });

  it('shows once behind the comparison', () => {
    const s = state(pbRun(), { index: 0 });
    expect(liveDelta(s, 12_000, 'Personal Best', 'RealTime')).toBe(2_000);
  });

  it('shows when losing time relative to the previous split delta', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 7_000; // -3.0 at A
    const s = state(segs, { index: 1 });
    // At 23s we are -2.0 against B: still ahead, but losing time since A.
    expect(liveDelta(s, 23_000, 'Personal Best', 'RealTime')).toBe(-2_000);
    // At 21s we are -4.0: gaining, so the live delta stays hidden.
    expect(liveDelta(s, 21_000, 'Personal Best', 'RealTime')).toBeNull();
  });

  it('shows when the current segment is already slower than the best segment', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 2_000; // -8.0 at A (huge lead)
    const s = state(segs, { index: 1 });
    // Segment B has run 14.5s: faster than PB's 15s (lead grows to -8.5) but slower than the 14s best.
    expect(liveDelta(s, 16_500, 'Personal Best', 'RealTime')).toBe(-8_500);
  });

  it('is null when the run is not active', () => {
    expect(liveDelta(state(pbRun(), { phase: 'NotRunning', index: -1 }), 1_000, 'Personal Best', 'RealTime')).toBeNull();
  });
});

describe('currentDelta', () => {
  it('uses the last split delta when the live delta is hidden', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 9_500;
    const s = state(segs, { index: 1 });
    expect(currentDelta(s, 12_000, 'Personal Best', 'RealTime')).toEqual({ value: -500, isLive: false });
  });

  it('skips over skipped splits to find the last delta', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 9_500;
    const s = state(segs, { index: 2 }); // B skipped
    expect(currentDelta(s, 30_000, 'Personal Best', 'RealTime')).toEqual({ value: -500, isLive: false });
  });

  it('reports the final delta once the run ended', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 9_000;
    segs[1].splitTime.realTime = 24_000;
    segs[2].splitTime.realTime = 44_000;
    const s = state(segs, { phase: 'Ended', index: 3, time: 44_000 });
    expect(currentDelta(s, 44_000, 'Personal Best', 'RealTime')).toEqual({ value: -1_000, isLive: false });
  });

  it('is null before the run starts', () => {
    expect(currentDelta(state(pbRun(), { phase: 'NotRunning', index: -1 }), 0, 'Personal Best', 'RealTime')).toBeNull();
  });

  it('keeps the last delta while the live delta is better, even if slower than the best segment', () => {
    // PB B segment 60s, gold 50s; 30s ahead at A, 52s into B.
    const segs = [segment('A', { pb: 100_000, best: 90_000 }), segment('B', { pb: 160_000, best: 50_000 })];
    segs[0].splitTime.realTime = 70_000;
    const s = state(segs, { index: 1 });
    expect(currentDelta(s, 122_000, 'Personal Best', 'RealTime')).toEqual({ value: -30_000, isLive: false });
  });

  it('keeps a larger previous deficit instead of the smaller live one', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 20_000; // +10.0
    const s = state(segs, { index: 1 });
    expect(currentDelta(s, 30_000, 'Personal Best', 'RealTime')).toEqual({ value: 10_000, isLive: false });
    expect(currentDelta(s, 37_000, 'Personal Best', 'RealTime')).toEqual({ value: 12_000, isLive: true });
  });

  it('shows a positive live delta before the first split', () => {
    const s = state(pbRun(), { index: 0 });
    expect(currentDelta(s, 11_000, 'Personal Best', 'RealTime')).toEqual({ value: 1_000, isLive: true });
    expect(currentDelta(s, 5_000, 'Personal Best', 'RealTime')).toBeNull();
  });
});

describe('currentPace and bestPossibleTime', () => {
  it('equal the comparison final time and sum of best before the run', () => {
    const s = state(pbRun(), { phase: 'NotRunning', index: -1 });
    expect(currentPace(s, 0, 'Personal Best', 'RealTime')).toBe(45_000);
    expect(bestPossibleTime(s, 0, 'RealTime')).toBe(41_000);
  });

  it('prefers the server-side sum of best before the run', () => {
    const s = state(pbRun(), { phase: 'NotRunning', index: -1 });
    s.run.advancedSumOfBest = 40_500;
    expect(bestPossibleTime(s, 0, 'RealTime')).toBe(40_500);
  });

  it('carry the last split delta forward', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 11_000; // +1.0 vs PB, +2.0 vs best
    const s = state(segs, { index: 1 });
    expect(currentPace(s, 12_000, 'Personal Best', 'RealTime')).toBe(46_000);
    expect(bestPossibleTime(s, 12_000, 'RealTime')).toBe(43_000);
  });

  it('grow with the live delta once it exceeds the last delta', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 11_000;
    const s = state(segs, { index: 1 });
    expect(currentPace(s, 30_000, 'Personal Best', 'RealTime')).toBe(50_000);
  });

  it('use the Best Segments comparison when LiveSplit provides it', () => {
    const segs = pbRun().map((seg, i) => ({
      ...seg,
      comparisons: { ...seg.comparisons, 'Best Segments': { realTime: [8_000, 20_000, 38_000][i], gameTime: null } },
    }));
    const s = state(segs, { phase: 'NotRunning', index: -1 });
    expect(bestPossibleTime(s, 0, 'RealTime')).toBe(38_000);
  });

  it('are the final time once the run ended', () => {
    const segs = pbRun();
    segs[2].splitTime.realTime = 44_000;
    const s = state(segs, { phase: 'Ended', index: 3 });
    expect(currentPace(s, 44_000, 'Personal Best', 'RealTime')).toBe(44_000);
    expect(bestPossibleTime(s, 44_000, 'RealTime')).toBe(44_000);
  });

  it('use game time when that is the timing method', () => {
    const segs = pbRun().map((seg) => ({
      ...seg,
      comparisons: { 'Personal Best': { realTime: seg.personalBest.realTime, gameTime: (seg.personalBest.realTime ?? 0) - 1_000 } },
    }));
    const s = state(segs, { phase: 'NotRunning', index: -1 });
    expect(currentPace(s, 0, 'Personal Best', 'GameTime')).toBe(44_000);
  });
});

describe('splitStatus (LiveSplit split colours)', () => {
  it('marks gold splits', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 8_000;
    expect(splitStatus(segs, 0, 'Personal Best', 'RealTime')).toBe('gold');
  });

  it('distinguishes gaining and losing time', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 9_500; // -0.5, not gold
    segs[1].splitTime.realTime = 24_900; // -0.1 (ahead, losing)
    segs[2].splitTime.realTime = 46_000; // +1.0 (behind, losing)
    expect(splitStatus(segs, 0, 'Personal Best', 'RealTime')).toBe('ahead-gaining');
    expect(splitStatus(segs, 1, 'Personal Best', 'RealTime')).toBe('ahead-losing');
    expect(splitStatus(segs, 2, 'Personal Best', 'RealTime')).toBe('behind-losing');
  });

  it('marks gold against Best Segments after a skipped split', () => {
    const segs = [segment('A', { pb: 12_000, best: 10_000 }), segment('B', { pb: 24_000, best: 10_000 })];
    segs[1].splitTime.realTime = 19_000; // A skipped; A+B in 19s beats 10s + 10s
    expect(splitStatus(segs, 1, 'Personal Best', 'RealTime')).toBe('gold');
  });

  it('treats an exact tie as ahead', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 9_500; // -0.5
    segs[1].splitTime.realTime = 25_000; // 0.0, losing vs -0.5
    expect(splitStatus(segs, 1, 'Personal Best', 'RealTime')).toBe('ahead-losing');
  });

  it('marks behind-gaining when the deficit shrinks', () => {
    const segs = pbRun();
    segs[0].splitTime.realTime = 12_000; // +2.0
    segs[1].splitTime.realTime = 26_000; // +1.0 and segment 14.0 == best, not gold
    expect(splitStatus(segs, 1, 'Personal Best', 'RealTime')).toBe('behind-gaining');
  });
});

describe('resolveComparison', () => {
  it('follows the comparison selected in LiveSplit when the splits have it', () => {
    const segs = pbRun().map((seg) => ({ ...seg, comparisons: { ...seg.comparisons, 'Average Segments': { realTime: 1, gameTime: null } } }));
    const s = state(segs);
    s.currentComparison = 'Average Segments';
    expect(resolveComparison(s)).toBe('Average Segments');
    s.currentComparison = 'Missing';
    expect(resolveComparison(s)).toBe('Personal Best');
  });
});

describe('segment names and sections', () => {
  it('parses subsplit and section notation', () => {
    expect(parseSegmentName('-Level 1')).toEqual({ display: 'Level 1', isSubsplit: true, sectionName: null });
    expect(parseSegmentName('{World 1} Boss')).toEqual({ display: 'Boss', isSubsplit: false, sectionName: 'World 1' });
    expect(parseSegmentName('{World 1}')).toEqual({ display: 'World 1', isSubsplit: false, sectionName: 'World 1' });
    expect(parseSegmentName('Final')).toEqual({ display: 'Final', isSubsplit: false, sectionName: null });
  });

  it('groups subsplits with the split that closes their section', () => {
    const names = ['Intro', '-1-1', '-1-2', '{World 1}1-3', '-2-1', '{World 2}2-2', 'Final', 'Credits'];
    expect(groupSegments(names)).toEqual([
      { section: null, indices: [0] },
      { section: 'World 1', indices: [1, 2, 3] },
      { section: 'World 2', indices: [4, 5] },
      { section: null, indices: [6, 7] },
    ]);
  });

  it('names a section after its closing split when braces are not used', () => {
    expect(groupSegments(['-a', '-b', 'Boss'])).toEqual([{ section: 'Boss', indices: [0, 1, 2] }]);
  });

  it('keeps trailing subsplits without a closing split', () => {
    expect(groupSegments(['A', '-b'])).toEqual([
      { section: null, indices: [0] },
      { section: null, indices: [1] },
    ]);
  });
});
