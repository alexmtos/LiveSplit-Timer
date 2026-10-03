import { describe, expect, it, vi } from 'vitest';
import { fetchWorldRecord, parseIsoDuration, parseLeaderboard, resolveSubcategoryFilters, worldRecordKey } from '@/lib/speedrun';
import type { RunMetadata } from '@/types';

const meta = (variables: Record<string, string> = {}): RunMetadata => ({
  gameId: 'game1',
  categoryId: 'cat1',
  regionId: null,
  platformId: null,
  emulator: false,
  regionName: null,
  platformName: null,
  variableNames: {},
  variables,
});

const variablesResponse = {
  data: [
    {
      id: 'subcat',
      'is-subcategory': true,
      values: { values: { v1: { label: 'Glitchless' }, v2: { label: 'Glitched' } } },
    },
    {
      id: 'platform',
      'is-subcategory': false,
      values: { values: { p1: { label: 'PC' } } },
    },
  ],
};

const leaderboardResponse = {
  data: {
    runs: [
      {
        place: 1,
        run: {
          weblink: 'https://www.speedrun.com/run/abc',
          date: '2026-01-02',
          players: [
            { rel: 'user', id: 'u1' },
            { rel: 'guest', name: 'GuestRunner' },
          ],
          times: { primary: 'PT1H2M3.450S', primary_t: 3723.45 },
        },
      },
    ],
    players: {
      data: [
        { id: 'u1', names: { international: 'Speedy' } },
        { rel: 'guest', name: 'GuestRunner' },
      ],
    },
  },
};

describe('resolveSubcategoryFilters', () => {
  it('maps labels to value IDs for sub-category variables only', () => {
    expect(resolveSubcategoryFilters(variablesResponse, { subcat: 'glitchless', platform: 'PC' })).toEqual({ subcat: 'v1' });
  });

  it('accepts value IDs as well', () => {
    expect(resolveSubcategoryFilters(variablesResponse, { subcat: 'v2' })).toEqual({ subcat: 'v2' });
  });
});

describe('parseLeaderboard', () => {
  it('reads time, co-op and guest players', () => {
    expect(parseLeaderboard(leaderboardResponse)).toEqual({
      timeMs: 3_723_450,
      players: ['Speedy', 'GuestRunner'],
      url: 'https://www.speedrun.com/run/abc',
      date: '2026-01-02',
    });
  });

  it('returns null for an empty leaderboard', () => {
    expect(parseLeaderboard({ data: { runs: [] } })).toBeNull();
  });
});

describe('parseIsoDuration', () => {
  it('parses speedrun.com durations', () => {
    expect(parseIsoDuration('PT1H2M3.45S')).toBe(3_723_450);
    expect(parseIsoDuration('P1DT2H')).toBe(93_600_000);
    expect(parseIsoDuration('PT')).toBeNull();
    expect(parseIsoDuration('garbage')).toBeNull();
  });
});

describe('worldRecordKey', () => {
  it('is stable regardless of variable order and null without IDs', () => {
    expect(worldRecordKey(meta({ b: '2', a: '1' }))).toBe(worldRecordKey(meta({ a: '1', b: '2' })));
    expect(worldRecordKey({ ...meta(), gameId: null })).toBeNull();
  });
});

describe('fetchWorldRecord', () => {
  it('resolves sub-category filters before querying the leaderboard', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const body = url.includes('/variables') ? variablesResponse : leaderboardResponse;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const record = await fetchWorldRecord(meta({ subcat: 'Glitchless' }), { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(record?.timeMs).toBe(3_723_450);
    const leaderboardUrl = fetchImpl.mock.calls[1][0];
    expect(leaderboardUrl).toContain('/leaderboards/game1/category/cat1?');
    expect(leaderboardUrl).toContain('var-subcat=v1');
  });

  it('skips the variables request when the run has no variables', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(leaderboardResponse), { status: 200 }));
    await fetchWorldRecord(meta(), { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws on HTTP errors so callers can show an error state', async () => {
    const fetchImpl = vi.fn(async () => new Response('rate limited', { status: 420 }));
    await expect(fetchWorldRecord(meta(), { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow('420');
  });
});
