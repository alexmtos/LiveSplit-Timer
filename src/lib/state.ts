import type { CommandError, LiveSplitState, RunMetadata, Segment, ServerInfo, TimeValue, TimerPhase, TimingMethod } from '@/types';

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

export interface TickUpdate {
  timerState: TimerPhase;
  currentTime: TimeValue;
  currentSplitIndex: number;
  isGameTimePaused: boolean;
}

export type ServerMessage =
  /** A full state: v1 greeting/event/reply, v2 hello/event, or the reply to `state`. */
  | { kind: 'state'; state: LiveSplitState; action: string | null; hello?: ServerInfo }
  /** v2 event sent without a state (depends on the subscription). */
  | { kind: 'event'; event: string }
  | { kind: 'tick'; tick: TickUpdate }
  | { kind: 'response'; id: string | number | null; action: string | null; ok: boolean; error: CommandError | null }
  | { kind: 'other' }
  /** Plain-text reply: typical of LiveSplit's built-in server, which this app does not speak. */
  | { kind: 'text'; text: string };

function toServerInfo(json: Json): ServerInfo {
  return {
    protocolVersion: json.protocolVersion === 2 ? 2 : 1,
    componentVersion: toText(json.componentVersion),
    liveSplitVersion: toText(json.liveSplitVersion),
    readOnly: json.readOnly === true,
  };
}

export function parseServerMessage(data: unknown): ServerMessage {
  if (typeof data !== 'string') return { kind: 'other' };
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { kind: 'text', text: data.trim() };
  }
  if (!isObject(json)) return { kind: 'other' };

  switch (json.type) {
    case 'hello': {
      const state = normalizeState(json.state);
      return state ? { kind: 'state', state, action: 'hello', hello: toServerInfo(json) } : { kind: 'other' };
    }
    case 'event': {
      const event = toText(json.event) ?? 'unknown';
      const state = normalizeState(json.state);
      return state ? { kind: 'state', state, action: event } : { kind: 'event', event };
    }
    case 'tick': {
      const phase = PHASES.find((p) => p === json.timerState);
      const index = toNumber(json.currentSplitIndex);
      if (!phase || index === null) return { kind: 'other' };
      return {
        kind: 'tick',
        tick: {
          timerState: phase,
          currentTime: toTimeValue(json.currentTime),
          currentSplitIndex: Math.trunc(index),
          isGameTimePaused: json.isGameTimePaused === true,
        },
      };
    }
    case 'response': {
      const action = toText(json.action);
      if (json.ok === true && action?.toLowerCase().replace('getstate', 'state') === 'state') {
        const state = normalizeState(json.data);
        if (state) return { kind: 'state', state, action: 'state' };
      }
      const error = isObject(json.error)
        ? { code: toText(json.error.code) ?? 'unknown', message: toText(json.error.message) ?? '', action }
        : null;
      const id = typeof json.id === 'string' || typeof json.id === 'number' ? json.id : null;
      return { kind: 'response', id, action, ok: json.ok === true, error };
    }
  }

  // Protocol version 1.
  const state = normalizeState(json.state);
  if (!state) return { kind: 'other' };
  const action = isObject(json.action) ? toText(json.action.action) : json.open ? 'open' : null;
  return { kind: 'state', state, action };
}

/** Icons of a state, keyed so they can be put back on states sent without icons. */
export interface IconCache {
  gameIcon: string | null;
  segments: Map<string, string>;
}

const iconKey = (index: number, name: string) => `${index}\u0000${name}`;

export function extractIcons(state: LiveSplitState): IconCache {
  const segments = new Map<string, string>();
  state.run.segments.forEach((seg, i) => {
    if (seg.icon) segments.set(iconKey(i, seg.name), seg.icon);
  });
  return { gameIcon: state.run.gameIcon, segments };
}

/** Fills in icons missing from a protocol 2 state (events omit them) from the cache. */
export function withCachedIcons(state: LiveSplitState, cache: IconCache | null): LiveSplitState {
  if (!cache) return state;
  const needsGameIcon = !state.run.gameIcon && cache.gameIcon;
  const needsSegmentIcons = state.run.segments.some((seg, i) => !seg.icon && cache.segments.has(iconKey(i, seg.name)));
  if (!needsGameIcon && !needsSegmentIcons) return state;
  return {
    ...state,
    run: {
      ...state.run,
      gameIcon: state.run.gameIcon ?? cache.gameIcon,
      segments: state.run.segments.map((seg, i) =>
        seg.icon ? seg : { ...seg, icon: cache.segments.get(iconKey(i, seg.name)) ?? null },
      ),
    },
  };
}

/** Whether a state carries icons (v1 always does; v2 only when requested). */
export function hasIcons(state: LiveSplitState): boolean {
  return !!state.run.gameIcon || state.run.segments.some((seg) => seg.icon);
}
