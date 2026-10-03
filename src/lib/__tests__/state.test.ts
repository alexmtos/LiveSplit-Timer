import { describe, expect, it } from 'vitest';
import { GreetingWatcher, extractIcons, hasIcons, normalizeState, parseServerMessage, withCachedIcons } from '@/lib/state';

// Shape produced by LiveSplit.WebSocketServer's JsonState.Create.
const serverState = {
  run: {
    gameIcon: null,
    gameName: 'Super Mario 64',
    categoryName: '16 Star',
    startingOffset: 0,
    attemptCount: 120,
    finishedCount: 30,
    comparisons: ['Personal Best', 'Best Segments'],
    advancedSumOfBest: 900_000,
    totalPlaytime: 1_000_000,
    segments: [
      {
        icon: 'data:image/png;base64,AAAA',
        name: '{Bob-omb}Star',
        splitTime: { realTime: 60_000, gameTime: null },
        personalBest: { realTime: 61_000, gameTime: null },
        bestSegment: { realTime: 58_000, gameTime: null },
        comparisons: { 'Personal Best': { realTime: 61_000, gameTime: null } },
      },
    ],
    metadata: {
      gameId: 'o1y9wo6q',
      categoryId: 'n2y1y72o',
      regionId: null,
      platformId: 'w89rwelk',
      emulator: false,
      variables: { e8m7em86: 'N64', ignored: 3 },
      platformName: 'Nintendo 64',
      variableNames: { Version: 'N64', Empty: '' },
    },
  },
  timerState: 'Running',
  currentComparison: 'Personal Best',
  currentTimingMethod: 'RealTime',
  currentTime: { realTime: 65_000, gameTime: null },
  loadingTimes: 0,
  isGameTimeInitialized: false,
  isGameTimePaused: false,
  attemptStarted: '2026-09-30T20:00:00.000Z',
  attemptEnded: '0001-01-01T00:00:00.000Z',
  pauseTime: null,
  currentAttemptDuration: 65_000,
  currentSplitIndex: 1,
};

describe('normalizeState', () => {
  it('reads game and category from the run object', () => {
    const state = normalizeState(serverState)!;
    expect(state.run.gameName).toBe('Super Mario 64');
    expect(state.run.categoryName).toBe('16 Star');
    expect(state.run.metadata.variables).toEqual({ e8m7em86: 'N64' });
    // Names from the splits file (component 2.x); absent ones are null or empty.
    expect(state.run.metadata).toMatchObject({ platformName: 'Nintendo 64', regionName: null, variableNames: { Version: 'N64' } });
    expect(state.run.segments[0].bestSegment.realTime).toBe(58_000);
  });

  it('rejects objects that are not LiveSplit states', () => {
    expect(normalizeState({ response: { response: 'hi' } })).toBeNull();
    expect(normalizeState({ run: { segments: [] }, timerState: 'Nope' })).toBeNull();
  });
});

describe('parseServerMessage', () => {
  it('accepts open, action and state replies', () => {
    expect(parseServerMessage(JSON.stringify({ open: { response: 'success' }, state: serverState }))).toMatchObject({
      kind: 'state',
      action: 'open',
    });
    expect(parseServerMessage(JSON.stringify({ action: { action: 'split', data: null }, state: serverState }))).toMatchObject({
      kind: 'state',
      action: 'split',
    });
  });

  it('ignores replies without a state instead of wiping the run', () => {
    expect(parseServerMessage(JSON.stringify({ response: { response: 'hi' } }))).toEqual({ kind: 'other' });
  });

  it('flags plain-text replies (LiveSplit built-in server)', () => {
    expect(parseServerMessage('1:23.45')).toEqual({ kind: 'text', text: '1:23.45' });
  });
});

describe('protocol version 2', () => {
  const iconless = {
    ...serverState,
    run: { ...serverState.run, gameIcon: null, segments: serverState.run.segments.map((seg) => ({ ...seg, icon: null })) },
  };

  it('reads hello with server details', () => {
    const message = parseServerMessage(
      JSON.stringify({ type: 'hello', protocolVersion: 2, componentVersion: '2.0.0', liveSplitVersion: '1.8.34', readOnly: true, state: serverState }),
    );
    expect(message).toMatchObject({
      kind: 'state',
      action: 'hello',
      hello: { protocolVersion: 2, componentVersion: '2.0.0', liveSplitVersion: '1.8.34', readOnly: true },
    });
  });

  it('reads events with and without a state', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'event', event: 'game-time-paused', state: serverState }))).toMatchObject({
      kind: 'state',
      action: 'game-time-paused',
    });
    expect(parseServerMessage(JSON.stringify({ type: 'event', event: 'run-changed', data: { path: 'x' } }))).toEqual({
      kind: 'event',
      event: 'run-changed',
    });
  });

  it('reads the state reply, other replies and errors', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'response', id: 'icons', action: 'state', ok: true, data: serverState }))).toMatchObject({
      kind: 'state',
      action: 'state',
    });
    expect(parseServerMessage(JSON.stringify({ type: 'response', id: 3, action: 'split', ok: true, data: {} }))).toEqual({
      kind: 'response',
      id: 3,
      action: 'split',
      ok: true,
      error: null,
    });
    expect(
      parseServerMessage(JSON.stringify({ type: 'response', ok: false, error: { code: 'unauthorized', message: 'A valid token is required.' } })),
    ).toEqual({
      kind: 'response',
      id: null,
      action: null,
      ok: false,
      error: { code: 'unauthorized', message: 'A valid token is required.', action: null },
    });
  });

  it('reads ticks', () => {
    expect(
      parseServerMessage(
        JSON.stringify({ type: 'tick', timerState: 'Running', currentTime: { realTime: 1000, gameTime: 900 }, currentSplitIndex: 2, currentDelta: -5, isGameTimePaused: true }),
      ),
    ).toEqual({
      kind: 'tick',
      tick: { timerState: 'Running', currentTime: { realTime: 1000, gameTime: 900 }, currentSplitIndex: 2, isGameTimePaused: true },
    });
  });

  it('puts cached icons back on states sent without icons', () => {
    const full = normalizeState(serverState)!;
    const bare = normalizeState(iconless)!;
    expect(hasIcons(bare)).toBe(false);
    const restored = withCachedIcons(bare, extractIcons(full));
    expect(restored.run.segments[0].icon).toBe('data:image/png;base64,AAAA');
  });

  it('does not reuse an icon when the split at that position changed', () => {
    const full = normalizeState(serverState)!;
    const renamed = normalizeState({ ...iconless, run: { ...iconless.run, segments: [{ ...iconless.run.segments[0], name: 'Other' }] } })!;
    expect(withCachedIcons(renamed, extractIcons(full)).run.segments[0].icon).toBeNull();
  });
});

describe('GreetingWatcher (why no state arrived)', () => {
  it('reports silence when nothing arrived', () => {
    expect(new GreetingWatcher().diagnostic()).toEqual({ reason: 'silent', detail: null });
  });

  it('reports the component error answered to the state request', () => {
    const watcher = new GreetingWatcher();
    watcher.observe(JSON.stringify({ type: 'response', action: 'state', ok: false, error: { code: 'internal', message: 'Object reference not set' } }));
    expect(watcher.diagnostic()).toEqual({ reason: 'error', detail: 'internal: Object reference not set' });
  });

  it('shows the start of an unrecognised message', () => {
    const watcher = new GreetingWatcher();
    watcher.observe(JSON.stringify({ type: 'hello', protocolVersion: 2, state: { run: {} } }));
    expect(watcher.diagnostic().reason).toBe('unknown');
    expect(watcher.diagnostic().detail).toContain('"type":"hello"');
  });

  it('prefers a plain-text reply, the signature of the built-in server', () => {
    const watcher = new GreetingWatcher();
    watcher.observe('{"x":1}');
    watcher.observe('0.00');
    expect(watcher.diagnostic()).toEqual({ reason: 'text', detail: '0.00' });
  });

  it('reports why the server closed the connection', () => {
    const watcher = new GreetingWatcher();
    watcher.closed(1011, 'Could not send the state. See LiveSplit\'s log in the Windows Event Viewer.');
    expect(watcher.diagnostic()).toEqual({
      reason: 'closed',
      detail: '1011: Could not send the state. See LiveSplit\'s log in the Windows Event Viewer.',
    });
    const bare = new GreetingWatcher();
    bare.closed(1006, '');
    expect(bare.diagnostic()).toEqual({ reason: 'closed', detail: '1006' });
  });

  it('prefers an error reply over the close that follows it', () => {
    const watcher = new GreetingWatcher();
    watcher.observe(JSON.stringify({ type: 'response', action: 'state', ok: false, error: { code: 'internal', message: 'boom' } }));
    watcher.closed(1011, 'bye');
    expect(watcher.diagnostic().reason).toBe('error');
  });

  it('truncates long messages', () => {
    const watcher = new GreetingWatcher();
    watcher.observe(JSON.stringify({ big: 'x'.repeat(1000) }));
    expect(watcher.diagnostic().detail?.length).toBe(301);
  });
});
