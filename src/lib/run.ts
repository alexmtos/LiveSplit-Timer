/**
 * Pure helpers that reproduce LiveSplit's own run math
 * (LiveSplitStateHelper, CurrentPace, BestPossibleTime, Subsplits) so the
 * overlay shows the same numbers LiveSplit shows.
 */

import type { LiveSplitState, Segment, TimeValue, TimerPhase, TimingMethod } from '@/types';

export const PERSONAL_BEST = 'Personal Best';
export const BEST_SEGMENTS = 'Best Segments';

export function pickTime(value: TimeValue | null | undefined, method: TimingMethod): number | null {
  if (!value) return null;
  const time = method === 'GameTime' ? value.gameTime : value.realTime;
  return typeof time === 'number' && Number.isFinite(time) ? time : null;
}

export function isRunActive(phase: TimerPhase): boolean {
  return phase === 'Running' || phase === 'Paused';
}

/** Snapshot of the timer taken when a state message arrived (`receivedAt` is `performance.now()`). */
export interface TimeAnchor {
  phase: TimerPhase;
  time: TimeValue;
  isGameTimePaused: boolean;
  receivedAt: number;
}

/**
 * Current time for `method`, extrapolated from the last snapshot. The server
 * only pushes state on events and every 15 s, so the running clock is local.
 */
export function extrapolateTime(anchor: TimeAnchor, method: TimingMethod, now: number): number | null {
  const base = pickTime(anchor.time, method);
  if (base === null) return null;
  if (anchor.phase !== 'Running') return base;
  if (method === 'GameTime' && anchor.isGameTimePaused) return base;
  return base + Math.max(0, now - anchor.receivedAt);
}

/** Time shown on the big timer: like LiveSplit, fall back to real time when game time is unavailable. */
export function displayTime(anchor: TimeAnchor | null, method: TimingMethod, now: number): number {
  if (!anchor) return 0;
  return extrapolateTime(anchor, method, now) ?? extrapolateTime(anchor, 'RealTime', now) ?? 0;
}

/** The comparison selected in LiveSplit, or Personal Best when the splits don't carry it. */
export function resolveComparison(state: LiveSplitState): string {
  const wanted = state.currentComparison;
  if (wanted && state.run.segments.some((seg) => seg.comparisons[wanted])) return wanted;
  return PERSONAL_BEST;
}

export function comparisonTime(seg: Segment | undefined, comparison: string, method: TimingMethod): number | null {
  if (!seg) return null;
  const value = seg.comparisons[comparison] ?? (comparison === PERSONAL_BEST ? seg.personalBest : undefined);
  return pickTime(value, method);
}

export function splitDelta(seg: Segment | undefined, comparison: string, method: TimingMethod): number | null {
  if (!seg) return null;
  const split = pickTime(seg.splitTime, method);
  const comp = comparisonTime(seg, comparison, method);
  return split !== null && comp !== null ? split - comp : null;
}

type ComparisonLookup = (index: number) => number | null;

function lastDeltaWith(
  segments: Segment[],
  index: number,
  lookup: ComparisonLookup,
  method: TimingMethod,
): number | null {
  for (let i = Math.min(index, segments.length) - 1; i >= 0; i--) {
    const split = pickTime(segments[i].splitTime, method);
    const comp = lookup(i);
    if (split !== null && comp !== null) return split - comp;
  }
  return null;
}

/** Delta of the last split before `index` that has both a split time and a comparison time. */
export function lastSplitDelta(
  segments: Segment[],
  index: number,
  comparison: string,
  method: TimingMethod,
): number | null {
  return lastDeltaWith(segments, index, (i) => comparisonTime(segments[i], comparison, method), method);
}

/** Cumulative sum of best segments; null from the first segment without a best segment. */
export function cumulativeBestSegments(segments: Segment[], method: TimingMethod): (number | null)[] {
  let total: number | null = 0;
  return segments.map((seg) => {
    const best = pickTime(seg.bestSegment, method);
    total = total === null || best === null ? null : total + best;
    return total;
  });
}

/** Lookup for the "Best Segments" comparison, computed locally when LiveSplit doesn't send it. */
function bestSegmentsLookup(segments: Segment[], method: TimingMethod): ComparisonLookup {
  if (segments.some((seg) => seg.comparisons[BEST_SEGMENTS])) {
    return (i) => comparisonTime(segments[i], BEST_SEGMENTS, method);
  }
  const cumulative = cumulativeBestSegments(segments, method);
  return (i) => cumulative[i] ?? null;
}

/** Split time of the last non-skipped split before `index` (0 at the start of the run). */
export function previousSplitTime(segments: Segment[], index: number, method: TimingMethod): number {
  for (let i = Math.min(index, segments.length) - 1; i >= 0; i--) {
    const time = pickTime(segments[i].splitTime, method);
    if (time !== null) return time;
  }
  return 0;
}

/**
 * Live delta against the current split, following LiveSplit's CheckLiveDelta:
 * it is only shown once the runner is behind the comparison, is losing time on
 * the current segment, or is already slower than their best segment.
 */
export function liveDelta(
  state: LiveSplitState,
  currentTime: number | null,
  comparison: string,
  method: TimingMethod,
): number | null {
  if (!isRunActive(state.timerState) || currentTime === null) return null;
  const segments = state.run.segments;
  const index = state.currentSplitIndex;
  const seg = segments[index];
  const comp = comparisonTime(seg, comparison, method);
  if (!seg || comp === null) return null;

  const delta = currentTime - comp;
  if (delta > 0) return delta;

  const segmentDelta = delta - (lastSplitDelta(segments, index, comparison, method) ?? 0);
  if (segmentDelta > 0) return delta;

  const bestSegment = pickTime(seg.bestSegment, method);
  const liveSegment = currentTime - previousSplitTime(segments, index, method);
  if (bestSegment !== null && liveSegment > bestSegment) {
    // Like LiveSplit, confirm against the Best Segments comparison so that
    // skipped splits (whose time is folded into this segment) don't count.
    const best = bestSegmentsLookup(segments, method);
    const bestComp = best(index);
    if (bestComp !== null) {
      const bestSegmentDelta = currentTime - bestComp - (lastDeltaWith(segments, index, best, method) ?? 0);
      if (bestSegmentDelta > 0) return delta;
    }
  }
  return null;
}

export interface CurrentDelta {
  value: number;
  isLive: boolean;
}

/**
 * The delta shown next to the timer (LiveSplit's "Delta" component): the last
 * split's delta, replaced by the live delta only once it is worse than that
 * (or positive, before the first split).
 */
export function currentDelta(
  state: LiveSplitState,
  currentTime: number | null,
  comparison: string,
  method: TimingMethod,
): CurrentDelta | null {
  const segments = state.run.segments;
  if (state.timerState === 'NotRunning' || segments.length === 0) return null;
  const index = state.currentSplitIndex;
  const last = lastSplitDelta(segments, index, comparison, method);
  if (isRunActive(state.timerState) && currentTime !== null) {
    const comp = comparisonTime(segments[index], comparison, method);
    if (comp !== null) {
      const live = currentTime - comp;
      if (last === null ? live > 0 : live > last) return { value: live, isLive: true };
    }
  }
  return last === null ? null : { value: last, isLive: false };
}

function paceAgainst(
  state: LiveSplitState,
  currentTime: number | null,
  lookup: ComparisonLookup,
  method: TimingMethod,
): number | null {
  const segments = state.run.segments;
  if (segments.length === 0) return null;
  const lastIndex = segments.length - 1;
  if (state.timerState === 'Ended') return pickTime(segments[lastIndex].splitTime, method);

  const final = lookup(lastIndex);
  if (final === null) return null;
  if (state.timerState === 'NotRunning') return final;

  const index = state.currentSplitIndex;
  let delta = lastDeltaWith(segments, index, lookup, method) ?? 0;
  const currentComp = lookup(index);
  if (currentTime !== null && currentComp !== null && currentTime - currentComp > delta) {
    delta = currentTime - currentComp;
  }
  return final + delta;
}

/** Predicted final time if the rest of the run matches the comparison (LiveSplit's "Current Pace"). */
export function currentPace(
  state: LiveSplitState,
  currentTime: number | null,
  comparison: string,
  method: TimingMethod,
): number | null {
  const segments = state.run.segments;
  return paceAgainst(state, currentTime, (i) => comparisonTime(segments[i], comparison, method), method);
}

/** Fastest final time still reachable: current pace against the sum of best segments. */
export function bestPossibleTime(
  state: LiveSplitState,
  currentTime: number | null,
  method: TimingMethod,
): number | null {
  const segments = state.run.segments;
  const hasBestSegments = segments.some((seg) => seg.comparisons[BEST_SEGMENTS]);
  if (!hasBestSegments && state.timerState === 'NotRunning' && state.run.advancedSumOfBest !== null) {
    return state.run.advancedSumOfBest;
  }
  return paceAgainst(state, currentTime, bestSegmentsLookup(segments, method), method);
}

export type SplitStatus =
  | 'gold'
  | 'ahead-gaining'
  | 'ahead-losing'
  | 'behind-gaining'
  | 'behind-losing'
  | 'neutral';

/** Segment duration for a finished split (time since the previous non-skipped split). */
export function segmentTime(segments: Segment[], index: number, method: TimingMethod): number | null {
  const split = pickTime(segments[index]?.splitTime, method);
  return split === null ? null : split - previousSplitTime(segments, index, method);
}

/** LiveSplit's CheckBestSegment, including the Best Segments check that covers skipped splits. */
export function isBestSegment(segments: Segment[], index: number, method: TimingMethod): boolean {
  const current = segmentTime(segments, index, method);
  if (current === null) return false;
  const best = pickTime(segments[index].bestSegment, method);
  if (best === null || current < best) return true;

  const lookup = bestSegmentsLookup(segments, method);
  const split = pickTime(segments[index].splitTime, method);
  const comp = lookup(index);
  if (split === null || comp === null) return false;
  return split - comp - (lastDeltaWith(segments, index, lookup, method) ?? 0) < 0;
}

/** Colour category for a finished split, following LiveSplit's GetSplitColor. */
export function splitStatus(
  segments: Segment[],
  index: number,
  comparison: string,
  method: TimingMethod,
): SplitStatus {
  if (isBestSegment(segments, index, method)) return 'gold';
  const delta = splitDelta(segments[index], comparison, method);
  if (delta === null) return 'neutral';
  const previous = lastSplitDelta(segments, index, comparison, method);
  // A tie counts as ahead, as in LiveSplit.
  if (delta <= 0) return previous !== null && delta > previous ? 'ahead-losing' : 'ahead-gaining';
  return previous !== null && delta < previous ? 'behind-gaining' : 'behind-losing';
}

export interface ParsedSegmentName {
  display: string;
  isSubsplit: boolean;
  /** Section name from the `{Section}Split` notation. */
  sectionName: string | null;
}

const SECTION_NAME = /^\{([^}]*)\}\s*(.*)$/;

export function parseSegmentName(name: string): ParsedSegmentName {
  if (name.startsWith('-')) {
    return { display: name.slice(1).trim() || name, isSubsplit: true, sectionName: null };
  }
  const match = name.match(SECTION_NAME);
  if (match) {
    const section = match[1].trim();
    return { display: match[2].trim() || section, isSubsplit: false, sectionName: section };
  }
  return { display: name, isSubsplit: false, sectionName: null };
}

export interface SegmentGroup {
  /** Section header, or null for splits that are not part of a section. */
  section: string | null;
  indices: number[];
}

/**
 * Groups segments the way LiveSplit's Subsplits component does: splits whose
 * name starts with "-" belong to the section closed by the next split without
 * "-". That closing split names the section, using the text inside `{...}` when
 * present ("{Castle}Bowser" -> section "Castle", split "Bowser").
 */
export function groupSegments(names: string[]): SegmentGroup[] {
  const groups: SegmentGroup[] = [];
  let pending: number[] = [];
  let loose: number[] = [];

  const flushLoose = () => {
    if (loose.length > 0) groups.push({ section: null, indices: loose });
    loose = [];
  };

  names.forEach((name, index) => {
    const parsed = parseSegmentName(name);
    if (parsed.isSubsplit) {
      pending.push(index);
      return;
    }
    if (pending.length > 0 || parsed.sectionName !== null) {
      flushLoose();
      groups.push({ section: parsed.sectionName ?? parsed.display, indices: [...pending, index] });
      pending = [];
      return;
    }
    loose.push(index);
  });

  flushLoose();
  if (pending.length > 0) groups.push({ section: null, indices: pending });
  return groups;
}
