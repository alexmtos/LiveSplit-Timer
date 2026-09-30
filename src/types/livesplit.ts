/**
 * Payload sent by the LiveSplit.WebSocketServer component
 * (https://github.com/alexmtos/LiveSplit.WebSocketServer, `JsonState.cs`).
 *
 * The server pushes `{ state }` when it accepts a connection (together with
 * `open`), on every timer event (together with `action`) and every 15 seconds
 * (`action: "refresh"`). All durations are integer milliseconds.
 */

export type TimerPhase = 'NotRunning' | 'Running' | 'Paused' | 'Ended';
export type TimingMethod = 'RealTime' | 'GameTime';

export interface TimeValue {
  realTime: number | null;
  gameTime: number | null;
}

export interface Segment {
  name: string;
  /** PNG data URL, or null when the segment has no icon. */
  icon: string | null;
  splitTime: TimeValue;
  personalBest: TimeValue;
  bestSegment: TimeValue;
  /** Cumulative split times per comparison ("Personal Best", "Best Segments", ...). */
  comparisons: Record<string, TimeValue>;
}

export interface RunMetadata {
  gameId: string | null;
  categoryId: string | null;
  regionId: string | null;
  platformId: string | null;
  emulator: boolean;
  /** speedrun.com variable ID -> selected value label (as stored by LiveSplit). */
  variables: Record<string, string>;
}

export interface Run {
  gameIcon: string | null;
  gameName: string;
  categoryName: string;
  startingOffset: number | null;
  attemptCount: number | null;
  finishedCount: number | null;
  comparisons: string[];
  advancedSumOfBest: number | null;
  totalPlaytime: number | null;
  segments: Segment[];
  metadata: RunMetadata;
}

export interface LiveSplitState {
  run: Run;
  timerState: TimerPhase;
  currentComparison: string;
  currentTimingMethod: TimingMethod;
  currentTime: TimeValue;
  isGameTimePaused: boolean;
  /** -1 before the run starts, `segments.length` once it has ended. */
  currentSplitIndex: number;
  attemptStarted: string | null;
  attemptEnded: string | null;
}

/** Text commands understood by LiveSplit.WebSocketServer (`LiveSplitWebSocketHandler.cs`). */
export type LiveSplitCommand =
  | 'hi'
  | 'state'
  | 'startorsplit'
  | 'starttimer'
  | 'split'
  | 'unsplit'
  | 'skipsplit'
  | 'pause'
  | 'resume'
  | 'reset'
  | 'pausegametime'
  | 'unpausegametime';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
