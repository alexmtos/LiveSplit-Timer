import { describe, expect, it } from 'vitest';
import { normalizeState, parseServerMessage } from '@/lib/state';

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
