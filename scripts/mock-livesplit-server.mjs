#!/usr/bin/env node
/**
 * Minimal stand-in for the LiveSplit.WebSocketServer component, for working on
 * the overlay without LiveSplit. It speaks the same protocol: pushes
 * `{ open, state }` on connect, `{ action, state }` on every event and every
 * 15 s, and accepts the same text commands.
 *
 *   npm run mock:server -- [--port 15721] [--scale 1] [--game-time] [--src]
 *
 * --scale multiplies every PB/best segment time (e.g. 0.05 for a quick run).
 * --game-time makes GameTime the current timing method (game time runs 3% slower
 * than real time, like a load-removed run).
 * --src links the run to a speedrun.com game/category (Super Mario 64, 16 Star)
 * so the world record lookup runs.
 */
import { WebSocketServer } from 'ws';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const port = Number(option('port', '15721'));
const scale = Number(option('scale', '1'));
const gameTimeMode = args.includes('--game-time');
const speedrunMetadata = args.includes('--src')
  ? { gameId: 'o1y9wo6q', categoryId: 'n2y1y72o', regionId: null, platformId: null, emulator: false, variables: { e8m7em86: 'N64' } }
  : { gameId: null, categoryId: null, regionId: null, platformId: null, emulator: false, variables: {} };

// [name, PB segment seconds, best segment seconds]
const SEGMENTS = [
  ['Intro', 42.3, 40.1],
  ['-1-1', 61.2, 58.7],
  ['-1-2', 75.8, 71.0],
  ['{World 1}Bowser 1', 95.4, 90.2],
  ['-2-1', 80.1, 77.5],
  ['{World 2}Castle', 102.6, 98.9],
  ['Final Boss', 130.0, 121.4],
];

const ms = (seconds) => Math.round(seconds * 1000 * scale);
const time = (realTime) => ({
  realTime,
  gameTime: realTime === null ? null : Math.round(realTime * 0.97),
});

let pbCumulative = 0;
const segments = SEGMENTS.map(([name, pb, best]) => {
  pbCumulative += ms(pb);
  return { name, pb: pbCumulative, best: ms(best) };
});
let bestCumulative = 0;
const bestSegmentsCumulative = segments.map((s) => (bestCumulative += s.best));

const timer = {
  phase: 'NotRunning',
  startedAt: 0,
  pausedTotal: 0,
  pausedAt: 0,
  index: -1,
  splits: segments.map(() => null),
  attempts: 41,
};

function now() {
  return Date.now();
}

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

function state() {
  return {
    run: {
      gameIcon: null,
      gameName: 'Mock Game 64',
      categoryName: 'Any%',
      startingOffset: 0,
      attemptCount: timer.attempts,
      finishedCount: 7,
      comparisons: ['Personal Best', 'Best Segments'],
      advancedSumOfBest: bestCumulative,
      totalPlaytime: 123_456_789,
      segments: segments.map((s, i) => ({
        icon: null,
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
    currentComparison: 'Personal Best',
    currentTimingMethod: gameTimeMode ? 'GameTime' : 'RealTime',
    currentTime: time(currentRealTime()),
    loadingTimes: 0,
    isGameTimeInitialized: gameTimeMode,
    isGameTimePaused: false,
    attemptStarted: new Date(timer.startedAt || now()).toISOString(),
    attemptEnded: '0001-01-01T00:00:00.000Z',
    pauseTime: timer.pausedTotal,
    currentAttemptDuration: currentRealTime(),
    currentSplitIndex: timer.index,
  };
}

const wss = new WebSocketServer({ port });
const broadcast = (action) => {
  const message = JSON.stringify({ action: { action, data: null }, state: state() });
  for (const client of wss.clients) if (client.readyState === 1) client.send(message);
};

function split() {
  if (timer.phase !== 'Running') return false;
  timer.splits[timer.index] = currentRealTime();
  timer.index += 1;
  if (timer.index >= segments.length) timer.phase = 'Ended';
  return true;
}

const commands = {
  starttimer() {
    if (timer.phase !== 'NotRunning') return null;
    Object.assign(timer, { phase: 'Running', startedAt: now(), pausedTotal: 0, index: 0, attempts: timer.attempts + 1 });
    return 'start';
  },
  startorsplit() {
    return timer.phase === 'Running' ? commands.split() : commands.starttimer();
  },
  split() {
    return split() ? 'split' : null;
  },
  skipsplit() {
    if ((timer.phase !== 'Running' && timer.phase !== 'Paused') || timer.index >= segments.length - 1) return null;
    timer.splits[timer.index] = null;
    timer.index += 1;
    return 'skip-split';
  },
  unsplit() {
    if (timer.index <= 0 || timer.phase === 'NotRunning') return null;
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
  reset() {
    if (timer.phase === 'NotRunning') return null;
    Object.assign(timer, { phase: 'NotRunning', index: -1, splits: segments.map(() => null), pausedTotal: 0 });
    return 'reset';
  },
};

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ open: { response: 'success' }, state: state() }));
  socket.on('message', (raw) => {
    let action = raw.toString();
    try {
      const parsed = JSON.parse(action);
      if (parsed && typeof parsed === 'object' && typeof parsed.action === 'string') action = parsed.action;
    } catch {
      // plain text command
    }
    if (action === 'hi') socket.send(JSON.stringify({ response: { response: 'hi' } }));
    else if (action === 'state') socket.send(JSON.stringify({ response: { response: 'state' }, state: state() }));
    else if (commands[action]) {
      const event = commands[action]();
      if (event) broadcast(event);
    }
    console.log(`<- ${action}  [${timer.phase} #${timer.index}]`);
  });
});

setInterval(() => broadcast('refresh'), 15_000);
console.log(`Mock LiveSplit.WebSocketServer on ws://localhost:${port} (scale ${scale}${gameTimeMode ? ', game time' : ''})`);
