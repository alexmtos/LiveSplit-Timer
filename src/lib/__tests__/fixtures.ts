import type { LiveSplitState, Segment, TimeValue, TimerPhase } from '@/types';

export const t = (realTime: number | null, gameTime: number | null = null): TimeValue => ({ realTime, gameTime });

export function segment(
  name: string,
  { split = null, pb = null, best = null, comparisons = {} }: {
    split?: number | null;
    pb?: number | null;
    best?: number | null;
    comparisons?: Record<string, number | null>;
  } = {},
): Segment {
  const comps: Record<string, TimeValue> = { 'Personal Best': t(pb) };
  for (const [key, value] of Object.entries(comparisons)) comps[key] = t(value);
  return { name, icon: null, splitTime: t(split), personalBest: t(pb), bestSegment: t(best), comparisons: comps };
}

export function state(
  segments: Segment[],
  { phase = 'Running', index = 0, time = 0 }: { phase?: TimerPhase; index?: number; time?: number } = {},
): LiveSplitState {
  return {
    run: {
      gameIcon: null,
      gameName: 'Game',
      categoryName: 'Any%',
      startingOffset: 0,
      attemptCount: 10,
      finishedCount: 2,
      comparisons: ['Personal Best'],
      advancedSumOfBest: null,
      totalPlaytime: null,
      segments,
      metadata: { gameId: null, categoryId: null, regionId: null, platformId: null, emulator: false, variables: {} },
    },
    timerState: phase,
    currentComparison: 'Personal Best',
    currentTimingMethod: 'RealTime',
    currentTime: t(time),
    isGameTimePaused: false,
    currentSplitIndex: index,
    attemptStarted: null,
    attemptEnded: null,
  };
}
