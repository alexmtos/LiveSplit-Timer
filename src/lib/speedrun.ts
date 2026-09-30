/**
 * World record lookup on speedrun.com (https://github.com/speedruncomorg/api).
 *
 * LiveSplit stores the selected value of each speedrun.com variable by its
 * *label* (e.g. "Glitchless"), while the leaderboard endpoint filters by value
 * *ID*, so labels are resolved through the category's variables first. Like
 * the speedrun.com site, only sub-category variables narrow the leaderboard.
 */

import type { RunMetadata } from '@/types';

const API = 'https://www.speedrun.com/api/v1';
const CACHE_KEY = 'livesplit-wr-cache';
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface WorldRecord {
  timeMs: number;
  players: string[];
  url: string | null;
  date: string | null;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Stable key for a game/category/variables combination, or null when the run is not linked to speedrun.com. */
export function worldRecordKey(meta: RunMetadata | undefined): string | null {
  if (!meta?.gameId || !meta.categoryId) return null;
  const vars = Object.keys(meta.variables)
    .sort()
    .map((id) => `${id}=${meta.variables[id]}`)
    .join('&');
  return `${meta.gameId}|${meta.categoryId}|${vars}`;
}

/** Maps LiveSplit's `{ variableId: label }` to `{ variableId: valueId }` for sub-category variables. */
export function resolveSubcategoryFilters(variablesResponse: unknown, selected: Record<string, string>): Record<string, string> {
  const filters: Record<string, string> = {};
  const list = isObject(variablesResponse) && Array.isArray(variablesResponse.data) ? variablesResponse.data : [];
  for (const variable of list) {
    if (!isObject(variable) || typeof variable.id !== 'string' || variable['is-subcategory'] !== true) continue;
    const wanted = selected[variable.id];
    if (!wanted) continue;
    const values = isObject(variable.values) && isObject(variable.values.values) ? variable.values.values : {};
    if (wanted in values) {
      filters[variable.id] = wanted;
      continue;
    }
    const normalized = wanted.trim().toLowerCase();
    const match = Object.entries(values).find(
      ([, value]) => isObject(value) && typeof value.label === 'string' && value.label.trim().toLowerCase() === normalized,
    );
    if (match) filters[variable.id] = match[0];
  }
  return filters;
}

function playerName(entry: unknown): string | null {
  if (!isObject(entry)) return null;
  if (isObject(entry.names)) {
    const names = entry.names;
    if (typeof names.international === 'string') return names.international;
    if (typeof names.japanese === 'string') return names.japanese;
  }
  return typeof entry.name === 'string' ? entry.name : null;
}

/** Extracts first place from a `/leaderboards/...?embed=players` response. */
export function parseLeaderboard(response: unknown): WorldRecord | null {
  const data = isObject(response) && isObject(response.data) ? response.data : null;
  const runs = data && Array.isArray(data.runs) ? data.runs : [];
  const first = runs.find((entry) => isObject(entry) && entry.place === 1) ?? runs[0];
  if (!isObject(first) || !isObject(first.run)) return null;
  const run = first.run;
  const times = isObject(run.times) ? run.times : {};

  let timeMs: number | null = null;
  if (typeof times.primary_t === 'number') timeMs = Math.round(times.primary_t * 1000);
  else if (typeof times.primary === 'string') timeMs = parseIsoDuration(times.primary);
  if (timeMs === null) return null;

  const embedded = data && isObject(data.players) && Array.isArray(data.players.data) ? data.players.data : [];
  const runPlayers = Array.isArray(run.players) ? run.players : [];
  const players = runPlayers
    .map((player) => {
      if (!isObject(player)) return null;
      if (player.rel === 'guest') return typeof player.name === 'string' ? player.name : null;
      const user = embedded.find((entry) => isObject(entry) && entry.id === player.id);
      return playerName(user);
    })
    .filter((name): name is string => !!name);

  return {
    timeMs,
    players,
    url: typeof run.weblink === 'string' ? run.weblink : null,
    date: typeof run.date === 'string' ? run.date : null,
  };
}

/** ISO 8601 duration ("PT1H2M3.45S", "P1DT2H") to milliseconds. */
export function parseIsoDuration(duration: string): number | null {
  const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match || duration === 'P' || duration.endsWith('T')) return null;
  const [, d, h, m, s] = match;
  return Math.round(((+(d ?? 0) * 24 + +(h ?? 0)) * 3600 + +(m ?? 0) * 60 + +(s ?? 0)) * 1000);
}

async function getJson(url: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`speedrun.com responded ${response.status}`);
  return response.json();
}

export async function fetchWorldRecord(
  meta: RunMetadata,
  { signal, fetchImpl = fetch }: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<WorldRecord | null> {
  if (!meta.gameId || !meta.categoryId) return null;
  const gameId = encodeURIComponent(meta.gameId);
  const categoryId = encodeURIComponent(meta.categoryId);

  let filters: Record<string, string> = {};
  if (Object.keys(meta.variables).length > 0) {
    const variables = await getJson(`${API}/categories/${categoryId}/variables`, fetchImpl, signal);
    filters = resolveSubcategoryFilters(variables, meta.variables);
  }

  const params = new URLSearchParams({ top: '1', embed: 'players' });
  for (const [id, value] of Object.entries(filters)) params.set(`var-${id}`, value);
  const leaderboard = await getJson(`${API}/leaderboards/${gameId}/category/${categoryId}?${params}`, fetchImpl, signal);
  return parseLeaderboard(leaderboard);
}

interface CacheEntry {
  savedAt: number;
  record: WorldRecord | null;
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isObject(parsed) ? (parsed as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

export function getCachedWorldRecord(key: string, now = Date.now()): CacheEntry | null {
  const entry = readCache()[key];
  return entry && now - entry.savedAt < CACHE_TTL_MS ? entry : null;
}

export function setCachedWorldRecord(key: string, record: WorldRecord | null, now = Date.now()) {
  try {
    const cache = readCache();
    for (const [k, entry] of Object.entries(cache)) {
      if (now - entry.savedAt >= CACHE_TTL_MS) delete cache[k];
    }
    cache[key] = { savedAt: now, record };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable (private mode, OBS without storage): skip caching.
  }
}
