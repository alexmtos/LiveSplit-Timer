#!/usr/bin/env node
/**
 * Stand-in for the LiveSplit.WebSocketServer component, for working on the
 * overlay without LiveSplit. Like component 2.x it speaks protocol version 2
 * to clients that connect with `?protocol=2` (hello, response, event) and
 * protocol version 1 to the others ({ open, state } and { action, state }).
 * See docs/PROTOCOL.md in alexmtos/LiveSplit.WebSocketServer.
 *
 *   npm run mock:server -- [--port 15721] [--scale 1] [--game-time] [--src]
 *                          [--token <token>] [--read-only] [--legacy] [--broken]
 *
 * --scale      multiplies every PB/best segment time (e.g. 0.05 for a quick run).
 * --game-time  starts with GameTime as the timing method (game time runs 3%
 *              slower than real time, like a load-removed run).
 * --src        links the run to a speedrun.com game/category so the world record
 *              lookup runs.
 * --token      requires ?token=<token>, like the component's Token setting.
 * --read-only  refuses control actions, like the component's Read only setting.
 * --legacy     behaves like component 1.x: protocol 1 only, ?protocol=2 ignored.
 * --broken     cannot build the greeting, like a component built for another
 *              LiveSplit version: closes every connection with 1011.
 */
import { WebSocketServer } from 'ws';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const port = Number(option('port', '15721'));
const scale = Number(option('scale', '1'));
const token = option('token', '');
const readOnly = args.includes('--read-only');
const legacy = args.includes('--legacy');
const broken = args.includes('--broken');
const speedrunMetadata = args.includes('--src')
  ? { gameId: 'o1y9wo6q', categoryId: 'n2y1y72o', regionId: null, platformId: null, emulator: false, variables: { e8m7em86: 'N64' } }
  : { gameId: null, categoryId: null, regionId: null, platformId: null, emulator: false, variables: {} };

// 1x1 PNGs, enough to check that icons reach the overlay.
const ICON_RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const ICON_BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

// [name, PB segment seconds, best segment seconds, icon]
const SEGMENTS = [
  ['Intro', 42.3, 40.1, ICON_RED],
  ['-1-1', 61.2, 58.7, null],
  ['-1-2', 75.8, 71.0, null],
  ['{World 1}Bowser 1', 95.4, 90.2, ICON_BLUE],
  ['-2-1', 80.1, 77.5, null],
  ['{World 2}Castle', 102.6, 98.9, null],
  ['Final Boss', 130.0, 121.4, ICON_RED],
];

const ms = (seconds) => Math.round(seconds * 1000 * scale);
const time = (realTime) => ({
  realTime,
  gameTime: realTime === null ? null : Math.round(realTime * 0.97),
});

let pbCumulative = 0;
const segments = SEGMENTS.map(([name, pb, best, icon]) => {
  pbCumulative += ms(pb);
  return { name, pb: pbCumulative, best: ms(best), icon };
});
let bestCumulative = 0;
const bestSegmentsCumulative = segments.map((s) => (bestCumulative += s.best));
const COMPARISONS = ['Personal Best', 'Best Segments'];

const timer = {
  phase: 'NotRunning',
  startedAt: 0,
  pausedTotal: 0,
  pausedAt: 0,
  index: -1,
  splits: segments.map(() => null),
  attempts: 41,
  comparison: 'Personal Best',
  timingMethod: args.includes('--game-time') ? 'GameTime' : 'RealTime',
};

const now = () => Date.now();

function currentRealTime() {
  switch (timer.phase) {
    case 'Running':
      return now() - timer.startedAt - timer.pausedTotal;
    case 'Paused':
      return timer.pausedAt - timer.startedAt - timer.pausedTotal;
    case 'Ended':
      return timer.splits[timer.splits.length - 1] ?? 0;
    default:
      return 0;
  }
}

function state({ includeIcons }) {
  return {
    run: {
      gameIcon: includeIcons ? ICON_BLUE : null,
      gameName: 'Mock Game 64',
      categoryName: 'Any%',
      startingOffset: 0,
      attemptCount: timer.attempts,
      finishedCount: 7,
      comparisons: COMPARISONS,
      advancedSumOfBest: bestCumulative,
      totalPlaytime: 123_456_789,
      segments: segments.map((s, i) => ({
        icon: includeIcons ? s.icon : null,
        name: s.name,
        splitTime: time(timer.splits[i]),
        personalBest: time(s.pb),
        bestSegment: time(s.best),
        comparisons: {
          'Personal Best': time(s.pb),
          'Best Segments': time(bestSegmentsCumulative[i]),
        },
      })),
      metadata: speedrunMetadata,
    },
    timerState: timer.phase,
    currentComparison: timer.comparison,
    currentTimingMethod: timer.timingMethod,
    currentTime: time(currentRealTime()),
    loadingTimes: 0,
    isGameTimeInitialized: timer.timingMethod === 'GameTime',
    isGameTimePaused: false,
    attemptStarted: new Date(timer.startedAt || now()).toISOString(),
    attemptEnded: '0001-01-01T00:00:00.000Z',
    pauseTime: timer.pausedTotal,
    currentAttemptDuration: currentRealTime(),
    currentSplitIndex: timer.index,
  };
}

class CommandError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const invalidPhase = (action) => new CommandError('invalid_phase', `'${action}' is not possible while the timer is ${timer.phase}.`);

// Each control action returns the name of the event it raises (or null).
const controls = {
  start() {
    if (timer.phase !== 'NotRunning') throw invalidPhase('start');
    Object.assign(timer, { phase: 'Running', startedAt: now(), pausedTotal: 0, index: 0, attempts: timer.attempts + 1 });
    return 'start';
  },
  startorsplit() {
    return timer.phase === 'Running' ? controls.split() : controls.start();
  },
  split() {
    if (timer.phase !== 'Running') throw invalidPhase('split');
    timer.splits[timer.index] = currentRealTime();
    timer.index += 1;
    if (timer.index >= segments.length) timer.phase = 'Ended';
    return 'split';
  },
  skipsplit() {
    if ((timer.phase !== 'Running' && timer.phase !== 'Paused') || timer.index >= segments.length - 1) throw invalidPhase('skipsplit');
    timer.splits[timer.index] = null;
    timer.index += 1;
    return 'skip-split';
  },
  undosplit() {
    if (timer.index <= 0 || timer.phase === 'NotRunning') throw invalidPhase('undosplit');
    if (timer.phase === 'Ended') timer.phase = 'Running';
    timer.index -= 1;
    timer.splits[timer.index] = null;
    return 'undo-split';
  },
  pause() {
    if (timer.phase !== 'Running') return null;
    Object.assign(timer, { phase: 'Paused', pausedAt: now() });
    return 'pause';
  },
  resume() {
    if (timer.phase !== 'Paused') return null;
    timer.pausedTotal += now() - timer.pausedAt;
    timer.phase = 'Running';
    return 'resume';
  },
  togglepause() {
    if (timer.phase === 'Running') return controls.pause();
    if (timer.phase === 'Paused') return controls.resume();
    throw invalidPhase('togglepause');
  },
  reset() {
    if (timer.phase === 'NotRunning') return null;
    Object.assign(timer, { phase: 'NotRunning', index: -1, splits: segments.map(() => null), pausedTotal: 0 });
    return 'reset';
  },
  setcomparison(a) {
    const comparison = a?.comparison;
    if (!COMPARISONS.includes(comparison)) throw new CommandError('invalid_args', `Unknown comparison '${comparison}'.`);
    timer.comparison = comparison;
    return 'comparison-changed';
  },
  settimingmethod(a) {
    const method = String(a?.method ?? '').toLowerCase();
    if (method !== 'realtime' && method !== 'gametime') throw new CommandError('invalid_args', "method must be 'realtime' or 'gametime'.");
    timer.timingMethod = method === 'gametime' ? 'GameTime' : 'RealTime';
    return 'timing-method-changed';
  },
};
const ALIASES = { starttimer: 'start', unsplit: 'undosplit' };
const LEGACY_ACTIONS = new Set(['hi', 'state', 'startorsplit', 'split', 'unsplit', 'skipsplit', 'pause', 'resume', 'reset', 'starttimer', 'pausegametime', 'unpausegametime']);

const wss = new WebSocketServer({ port });

function broadcast(event) {
  for (const client of wss.clients) {
    if (client.readyState !== 1 || !client.greeted) continue;
    if (client.protocol2) {
      client.send(JSON.stringify({ type: 'event', event, state: state({ includeIcons: false }) }));
    } else if (!['comparison-changed', 'timing-method-changed'].includes(event)) {
      // Protocol 1 only receives the events LiveSplit itself raises.
      client.send(JSON.stringify({ action: { action: event, data: null }, state: state({ includeIcons: true }) }));
    }
  }
}

function parseRequest(raw) {
  const text = raw.toString();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object' && typeof json.action === 'string') {
      return { id: json.id, action: json.action.toLowerCase(), args: json.args ?? json.data ?? null };
    }
  } catch {
    // plain text: "action argument"
  }
  const [action, ...rest] = text.trim().split(' ');
  return { id: undefined, action: action.toLowerCase(), args: rest.length ? { value: rest.join(' ') } : null };
}

function execute(socket, { action, args }) {
  const name = ALIASES[action] ?? action;
  switch (name) {
    case 'hi':
    case 'ping':
      return name === 'ping' ? 'pong' : null;
    case 'state':
    case 'getstate':
      return state({ includeIcons: !socket.protocol2 || args?.includeIcons === true });
    case 'subscribe':
      return {};
    case 'hello':
      if (legacy) throw new CommandError('unknown_action', "Unknown action 'hello'.");
      socket.protocol2 = true;
      return hello();
    case 'pausegametime':
    case 'unpausegametime':
      return null;
  }
  if (!controls[name]) throw new CommandError('unknown_action', `Unknown action '${action}'.`);
  if (readOnly) throw new CommandError('read_only', 'The server is in read only mode.');
  const event = controls[name](args);
  if (event) broadcast(event);
  return { timerState: timer.phase, currentSplitIndex: timer.index };
}

const hello = () => ({
  type: 'hello',
  protocolVersion: 2,
  componentVersion: '2.0.0-mock',
  liveSplitVersion: '1.8.34',
  readOnly,
  fileCommandsAllowed: false,
  state: state({ includeIcons: false }),
});

wss.on('connection', (socket, request) => {
  const query = new URL(request.url ?? '/', 'ws://localhost').searchParams;
  if (!legacy && token && query.get('token') !== token) {
    socket.send(JSON.stringify({ type: 'response', action: null, ok: false, error: { code: 'unauthorized', message: 'A valid token is required. Connect with ?token=... (see the component settings).' } }));
    socket.close(1008, 'Unauthorized');
    return;
  }
  if (broken) {
    socket.close(1011, "Could not send the state. See LiveSplit's log in the Windows Event Viewer.");
    return;
  }
  socket.protocol2 = !legacy && query.get('protocol') === '2';
  socket.send(JSON.stringify(socket.protocol2 ? hello() : { open: { response: 'success' }, state: state({ includeIcons: true }) }));
  socket.greeted = true;

  socket.on('message', (raw) => {
    const request = parseRequest(raw);
    const replyLegacy = !socket.protocol2 && (legacy || LEGACY_ACTIONS.has(request.action));
    try {
      const data = execute(socket, request);
      if (replyLegacy) {
        if (request.action === 'hi') socket.send(JSON.stringify({ response: { response: 'hi' } }));
        if (request.action === 'state') socket.send(JSON.stringify({ response: { response: 'state' }, state: data }));
      } else if (request.action === 'hello') {
        socket.send(JSON.stringify({ type: 'response', id: request.id, action: request.action, ok: true, data }));
      } else {
        socket.send(JSON.stringify({ type: 'response', id: request.id, action: request.action, ok: true, ...(data === null ? {} : { data }) }));
      }
    } catch (error) {
      if (!replyLegacy && error instanceof CommandError) {
        socket.send(JSON.stringify({ type: 'response', id: request.id, action: request.action, ok: false, error: { code: error.code, message: error.message } }));
      }
    }
    console.log(`<- ${request.action}  [v${socket.protocol2 ? 2 : 1} ${timer.phase} #${timer.index}]`);
  });
});

setInterval(() => broadcast('refresh'), 15_000);
console.log(
  `Mock LiveSplit.WebSocketServer on ws://localhost:${port} (${legacy ? 'component 1.x, protocol 1' : 'component 2.x, protocols 1 and 2'}` +
    `, scale ${scale}${timer.timingMethod === 'GameTime' ? ', game time' : ''}${token ? ', token' : ''}${readOnly ? ', read only' : ''}${broken ? ', broken greeting' : ''})`,
);
