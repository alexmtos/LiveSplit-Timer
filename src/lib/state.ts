import type { LiveSplitState, RunMetadata, Segment, TimeValue, TimerPhase, TimingMethod } from '@/types';

type Json = Record<string, unknown>;

const PHASES: TimerPhase[] = ['NotRunning', 'Running', 'Paused', 'Ended'];

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const toText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Accepts `{ realTime, gameTime }` or a bare number (treated as real time). */
function toTimeValue(value: unknown): TimeValue {
  if (isObject(value)) return { realTime: toNumber(value.realTime), gameTime: toNumber(value.gameTime) };
  return { realTime: toNumber(value), gameTime: null };
}

function toSegment(value: unknown): Segment | null {
  if (!isObject(value)) return null;
  const comparisons: Record<string, TimeValue> = {};
  if (isObject(value.comparisons)) {
    for (const [name, time] of Object.entries(value.comparisons)) comparisons[name] = toTimeValue(time);
  }
  const personalBest = value.personalBest !== undefined
    ? toTimeValue(value.personalBest)
    : comparisons['Personal Best'] ?? { realTime: null, gameTime: null };
  return {
    name: toText(value.name) ?? '',
    icon: toText(value.icon) || null,
    splitTime: toTimeValue(value.splitTime),
    personalBest,
    bestSegment: toTimeValue(value.bestSegment),
    comparisons,
  };
}

function toMetadata(value: unknown): RunMetadata {
  const meta = isObject(value) ? value : {};
  const variables: Record<string, string> = {};
  if (isObject(meta.variables)) {
    for (const [id, label] of Object.entries(meta.variables)) {
      if (typeof label === 'string' && label !== '') variables[id] = label;
    }
  }
  return {
    gameId: toText(meta.gameId),
    categoryId: toText(meta.categoryId),
    regionId: toText(meta.regionId),
    platformId: toText(meta.platformId),
    emulator: meta.emulator === true,
    variables,
  };
}

/** Validates and normalises a `state` object; returns null when it is not a LiveSplit state. */
export function normalizeState(raw: unknown): LiveSplitState | null {
  if (!isObject(raw) || !isObject(raw.run) || !Array.isArray(raw.run.segments)) return null;
  const phase = PHASES.find((p) => p === raw.timerState);
  if (!phase) return null;

  const run = raw.run;
  const segments = run.segments as unknown[];
  const normalizedSegments = segments.map(toSegment).filter((seg): seg is Segment => seg !== null);
  const method: TimingMethod = raw.currentTimingMethod === 'GameTime' ? 'GameTime' : 'RealTime';
  const index = toNumber(raw.currentSplitIndex);

  return {
    run: {
      gameIcon: toText(run.gameIcon) || null,
      gameName: toText(run.gameName) ?? toText(raw.gameName) ?? '',
      categoryName: toText(run.categoryName) ?? toText(raw.categoryName) ?? '',
      startingOffset: toNumber(run.startingOffset),
      attemptCount: toNumber(run.attemptCount),
      finishedCount: toNumber(run.finishedCount),
      comparisons: Array.isArray(run.comparisons) ? run.comparisons.filter((c): c is string => typeof c === 'string') : [],
      advancedSumOfBest: toNumber(run.advancedSumOfBest),
      totalPlaytime: toNumber(run.totalPlaytime),
      segments: normalizedSegments,
      metadata: toMetadata(run.metadata),
    },
    timerState: phase,
    currentComparison: toText(raw.currentComparison) ?? 'Personal Best',
    currentTimingMethod: method,
    currentTime: toTimeValue(raw.currentTime),
    isGameTimePaused: raw.isGameTimePaused === true,
    currentSplitIndex: index === null ? -1 : Math.trunc(index),
    attemptStarted: toText(raw.attemptStarted),
    attemptEnded: toText(raw.attemptEnded),
  };
}

export type ServerMessage =
  | { kind: 'state'; state: LiveSplitState; action: string | null }
  | { kind: 'other' }
  /** Plain-text reply: typical of LiveSplit's built-in server, which this app does not speak. */
  | { kind: 'text'; text: string };

export function parseServerMessage(data: unknown): ServerMessage {
  if (typeof data !== 'string') return { kind: 'other' };
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { kind: 'text', text: data.trim() };
  }
  if (!isObject(json)) return { kind: 'other' };
  const state = normalizeState(json.state);
  if (!state) return { kind: 'other' };
  const action = isObject(json.action) ? toText(json.action.action) : json.open ? 'open' : null;
  return { kind: 'state', state, action };
}
