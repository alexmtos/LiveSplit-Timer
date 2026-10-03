/**
 * State sent by the LiveSplit.WebSocketServer component
 * (https://github.com/alexmtos/LiveSplit.WebSocketServer, `docs/PROTOCOL.md`).
 *
 * Protocol version 2 (component 2.x, `?protocol=2`) sends typed messages:
 * `hello` with the state on connect, `event` with the state on every change
 * (without icons unless requested), `response` for every request and `tick`.
 * Protocol version 1 (component 1.x) pushes `{ open, state }` on connect and
 * `{ action, state }` on events. In both, all durations are integer milliseconds.
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
  /** speedrun.com variable ID -> selected value label (as stored by LiveSplit); empty until LiveSplit has loaded speedrun.com data. */
  variables: Record<string, string>;
  /** Names from the splits file, always sent by component 2.x (null or empty from older versions). */
  regionName: string | null;
  platformName: string | null;
  /** Variable name -> selected value, as stored in the splits file. */
  variableNames: Record<string, string>;
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

/** Actions used by the app. The protocol 1 names also work in protocol 2. */
export type LiveSplitCommand =
  | 'hi'
  | 'ping'
  | 'state'
  | 'subscribe'
  | 'startorsplit'
  | 'starttimer'
  | 'split'
  | 'unsplit'
  | 'skipsplit'
  | 'pause'
  | 'resume'
  | 'togglepause'
  | 'reset'
  | 'pausegametime'
  | 'unpausegametime'
  | 'setcomparison'
  | 'settimingmethod';

/** Protocol 2 only: what the server reported in its `hello` message. */
export interface ServerInfo {
  protocolVersion: 1 | 2;
  componentVersion: string | null;
  liveSplitVersion: string | null;
  readOnly: boolean;
}

/** Protocol 2 error codes (`docs/PROTOCOL.md`). */
export interface CommandError {
  code: string;
  message: string;
  action: string | null;
}

/**
 * Why a connection that opened never produced a timer state:
 * `silent` nothing arrived, `error` the component answered with an error,
 * `unknown` an unrecognised message arrived, `text` a plain-text reply
 * (LiveSplit's built-in server), `closed` the server closed the connection.
 */
export interface ConnectionDiagnostic {
  reason: 'silent' | 'error' | 'unknown' | 'text' | 'closed';
  /** The error or the start of the message, when there is one. */
  detail: string | null;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
