import { describe, expect, it, vi } from 'vitest';
import { categoryExtras, extendedCategoryName } from '@/lib/category';
import { fetchSpeedrunName } from '@/lib/speedrun';
import type { RunMetadata } from '@/types';

const meta = (over: Partial<RunMetadata> = {}): RunMetadata => ({
  gameId: 'g',
  categoryId: 'c',
  regionId: null,
  platformId: null,
  emulator: false,
  variables: {},
  ...over,
});

describe('categoryExtras', () => {
  it('lists variables, region and platform like LiveSplit', () => {
    expect(categoryExtras(meta({ variables: { a: 'Glitchless', b: '' } }), { region: 'NTSC', platform: 'N64' }, 'Emulator')).toEqual([
      'Glitchless',
      'NTSC',
      'N64',
    ]);
  });

  it('marks emulator runs, with or without a platform', () => {
    expect(categoryExtras(meta({ emulator: true }), { region: null, platform: 'N64' }, 'Emulador')).toEqual(['N64 Emulador']);
    expect(categoryExtras(meta({ emulator: true }), { region: null, platform: null }, 'Emulador')).toEqual(['Emulador']);
  });
});

describe('extendedCategoryName', () => {
  it('adds the extras in parentheses', () => {
    expect(extendedCategoryName('Any%', ['Glitchless', 'N64'])).toBe('Any% (Glitchless, N64)');
    expect(extendedCategoryName('Any%', [])).toBe('Any%');
  });

  it('merges with parentheses already in the name and keeps what follows them', () => {
    expect(extendedCategoryName('16 Star (No BLJ) Race', ['N64'])).toBe('16 Star (No BLJ, N64) Race');
    expect(extendedCategoryName('Any% (N64)', ['N64'])).toBe('Any% (N64)');
  });
});

describe('fetchSpeedrunName', () => {
  it('reads the name from speedrun.com', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'w89rwelk', name: 'Nintendo 64' } }))) as unknown as typeof fetch;
    await expect(fetchSpeedrunName('platforms', 'w89rwelk', { fetchImpl })).resolves.toBe('Nintendo 64');
    expect(fetchImpl).toHaveBeenCalledWith('https://www.speedrun.com/api/v1/platforms/w89rwelk', expect.anything());
  });

  it('is null without a name and throws on errors', async () => {
    const empty = vi.fn(async () => new Response(JSON.stringify({ data: {} }))) as unknown as typeof fetch;
    await expect(fetchSpeedrunName('regions', 'x', { fetchImpl: empty })).resolves.toBeNull();
    const failing = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchSpeedrunName('regions', 'x', { fetchImpl: failing })).rejects.toThrow();
  });
});
