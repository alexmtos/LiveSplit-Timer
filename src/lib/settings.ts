import { LANGUAGES, OVERLAY_SECTIONS, SECTION_SETTING, type Language, type OverlaySection, type Settings } from '@/types';
import { DEFAULT_REFRESH_RATE, REFRESH_RATES } from './ticker';
import { DEFAULT_PORT, DEFAULT_WS_URL, buildWsUrl, parseWsUrl } from './connection';
import { CUSTOM_THEME, DEFAULT_CUSTOM_THEME, isThemeId, toHexColor, type CustomThemeColors } from './themes';

export const SETTINGS_STORAGE_KEY = 'livesplit-settings';

/** Allowed maximum sizes of the images, in CSS pixels. */
export const GAME_ICON_SIZES = { min: 16, max: 128, step: 4 } as const;
export const SPLIT_ICON_SIZES = { min: 16, max: 64, step: 2 } as const;

export const DEFAULT_SETTINGS: Settings = {
  language: 'pt-BR',
  theme: 'default',
  customTheme: { ...DEFAULT_CUSTOM_THEME },
  showHeader: true,
  showTimer: true,
  showPredictions: true,
  showControls: true,
  showGraph: true,
  showTable: true,
  sectionOrder: [...OVERLAY_SECTIONS],
  alwaysExpandedSplits: false,
  hotkeysEnabled: true,
  streamMode: false,
  wsUrl: DEFAULT_WS_URL,
  token: '',
  chromaKey: {
    enabled: false,
  },
  transparency: 100,
  refreshRate: DEFAULT_REFRESH_RATE,
  gameIconSize: 44,
  splitIconSize: 32,
};

function toRefreshRate(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return (REFRESH_RATES as readonly unknown[]).includes(number) ? (number as number) : null;
}

/** A whole percentage from 0 to 100, or null. */
function toPercent(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : null;
}

const isSection = (value: unknown): value is OverlaySection =>
  typeof value === 'string' && (OVERLAY_SECTIONS as readonly string[]).includes(value);

/**
 * A complete section order: the valid sections of `value`, once each and in
 * its order, then the missing ones in the default order. Null when `value`
 * names no section.
 */
export function toSectionOrder(value: unknown): OverlaySection[] | null {
  if (!Array.isArray(value)) return null;
  const listed = [...new Set(value.filter(isSection))];
  if (listed.length === 0) return null;
  return [...listed, ...OVERLAY_SECTIONS.filter((section) => !listed.includes(section))];
}

export const isDefaultSectionOrder = (order: readonly OverlaySection[]) =>
  order.every((section, index) => section === OVERLAY_SECTIONS[index]);

/** A whole number of pixels within `range`, or null. */
function toPixels(value: unknown, range: { min: number; max: number }): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= range.min && number <= range.max ? Math.round(number) : null;
}

/** Custom theme colours from an object (stored settings) or from `bg,text,accent` hex digits (URL); null when any is invalid. */
function toCustomTheme(value: unknown): CustomThemeColors | null {
  const parts =
    typeof value === 'string'
      ? value.split(',')
      : typeof value === 'object' && value !== null
        ? [(value as Record<string, unknown>).bg, (value as Record<string, unknown>).text, (value as Record<string, unknown>).accent]
        : [];
  const [bg, text, accent] = parts.map(toHexColor);
  return parts.length === 3 && bg && text && accent ? { bg, text, accent } : null;
}

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const BOOLEAN_KEYS: BooleanKey[] = [
  'showHeader',
  'showTimer',
  'showPredictions',
  'showControls',
  'showGraph',
  'showTable',
  'alwaysExpandedSplits',
  'hotkeysEnabled',
  'streamMode',
];

const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** Supported language for a BCP 47 tag ("pt-BR", "en", "fr-CA"), or null. */
export function matchLanguage(tag: string): Language | null {
  const normalized = tag.trim().toLowerCase();
  const exact = LANGUAGES.find((lang) => lang.toLowerCase() === normalized);
  if (exact) return exact;
  const base = normalized.split('-')[0];
  return LANGUAGES.find((lang) => lang.toLowerCase().split('-')[0] === base) ?? null;
}

/** Picks the best supported language from the browser's preferences. */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const match = matchLanguage(tag);
    if (match) return match;
  }
  return DEFAULT_SETTINGS.language;
}

function isWsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'ws:' || url.protocol === 'wss:';
  } catch {
    return false;
  }
}

/** Merges stored settings over the defaults, dropping anything invalid or unknown. */
export function sanitizeSettings(raw: unknown, fallbackLanguage: Language = DEFAULT_SETTINGS.language): Settings {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const chroma = input.chromaKey as { enabled?: unknown } | undefined;
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    language: isLanguage(input.language) ? input.language : fallbackLanguage,
    theme: isThemeId(input.theme) ? input.theme : DEFAULT_SETTINGS.theme,
    customTheme: toCustomTheme(input.customTheme) ?? { ...DEFAULT_CUSTOM_THEME },
    wsUrl: isWsUrl(input.wsUrl) ? input.wsUrl : DEFAULT_SETTINGS.wsUrl,
    token: typeof input.token === 'string' ? input.token.trim() : DEFAULT_SETTINGS.token,
    chromaKey: {
      enabled: typeof chroma?.enabled === 'boolean' ? chroma.enabled : DEFAULT_SETTINGS.chromaKey.enabled,
    },
    transparency: toPercent(input.transparency) ?? DEFAULT_SETTINGS.transparency,
    refreshRate: toRefreshRate(input.refreshRate) ?? DEFAULT_SETTINGS.refreshRate,
    sectionOrder: toSectionOrder(input.sectionOrder) ?? [...OVERLAY_SECTIONS],
    gameIconSize: toPixels(input.gameIconSize, GAME_ICON_SIZES) ?? DEFAULT_SETTINGS.gameIconSize,
    splitIconSize: toPixels(input.splitIconSize, SPLIT_ICON_SIZES) ?? DEFAULT_SETTINGS.splitIconSize,
  };
  for (const key of BOOLEAN_KEYS) {
    if (typeof input[key] === 'boolean') settings[key] = input[key] as boolean;
  }
  return settings;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['', '1', 'true', 'yes', 'on', 'sim'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'nao', 'não'].includes(normalized)) return false;
  return undefined;
}

function parseSections(value: string | null): OverlaySection[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .map((part) => (part === 'table' ? 'splits' : part))
    .filter(isSection);
}

/**
 * Reads settings from the page URL. They apply to this page only and are never
 * saved, so each OBS browser source can have its own configuration:
 *
 *   ?host=192.168.0.10&port=15721&theme=matrix&lang=en-US&transparent=1&transparency=60
 *   &stream=1&hide=controls,graph&expanded=1&hotkeys=0&order=timer,splits&gameicon=48&spliticon=32
 *
 * `order` lists sections from the top; the ones it leaves out follow in the default order.
 * `theme=custom` takes its colours from `colors=<background>,<secondary text>,<accent>` (hex, no `#`).
 */
export function parseUrlOverrides(search: string, currentWsUrl: string): Partial<Settings> {
  const params = new URLSearchParams(search);
  const overrides: Partial<Settings> = {};

  const ws = params.get('ws');
  if (ws && isWsUrl(ws)) {
    overrides.wsUrl = ws;
  } else if (params.has('host') || params.has('port')) {
    const current = parseWsUrl(currentWsUrl);
    const url = buildWsUrl(
      params.get('host') ?? current.host,
      params.get('port') ?? (params.has('host') ? DEFAULT_PORT : current.port),
      parseBoolean(params.get('secure')) ?? false,
    );
    if (url) overrides.wsUrl = url;
  }

  const token = params.get('token');
  if (token !== null) overrides.token = token.trim();

  const theme = params.get('theme');
  if (isThemeId(theme)) overrides.theme = theme;
  const colors = toCustomTheme(params.get('colors'));
  if (colors) overrides.customTheme = colors;

  const lang = params.get('lang');
  const language = lang ? matchLanguage(lang) : null;
  if (language) overrides.language = language;

  const transparent = parseBoolean(params.get('transparent'));
  if (transparent !== undefined) overrides.chromaKey = { enabled: transparent };

  const transparency = toPercent(params.get('transparency'));
  if (transparency !== null) overrides.transparency = transparency;

  const refreshRate = toRefreshRate(params.get('fps'));
  if (refreshRate !== null) overrides.refreshRate = refreshRate;

  const gameIconSize = toPixels(params.get('gameicon'), GAME_ICON_SIZES);
  if (gameIconSize !== null) overrides.gameIconSize = gameIconSize;
  const splitIconSize = toPixels(params.get('spliticon'), SPLIT_ICON_SIZES);
  if (splitIconSize !== null) overrides.splitIconSize = splitIconSize;

  const flags: [string, BooleanKey][] = [
    ['stream', 'streamMode'],
    ['expanded', 'alwaysExpandedSplits'],
    ['hotkeys', 'hotkeysEnabled'],
  ];
  for (const [param, key] of flags) {
    const value = parseBoolean(params.get(param));
    if (value !== undefined) overrides[key] = value;
  }

  const order = toSectionOrder(parseSections(params.get('order')));
  if (order) overrides.sectionOrder = order;

  for (const section of parseSections(params.get('show'))) overrides[SECTION_SETTING[section] as BooleanKey] = true;
  for (const section of parseSections(params.get('hide'))) overrides[SECTION_SETTING[section] as BooleanKey] = false;

  return overrides;
}

/**
 * Builds a URL that reproduces `settings` for the given page ("/" or "/timer").
 * `basePath` and `trailingSlash` match the deployment (GitHub Pages serves the
 * app from "/<repository>/" with "/timer/" style paths).
 */
export function buildOverlayUrl(
  origin: string,
  path: string,
  settings: Settings,
  { basePath = '', trailingSlash = false }: { basePath?: string; trailingSlash?: boolean } = {},
): string {
  const params = new URLSearchParams();
  const address = parseWsUrl(settings.wsUrl);
  if (settings.wsUrl !== DEFAULT_WS_URL) {
    params.set('host', address.host);
    params.set('port', address.port);
    if (address.secure) params.set('secure', '1');
  }
  if (settings.token) params.set('token', settings.token);
  if (settings.theme !== DEFAULT_SETTINGS.theme) params.set('theme', settings.theme);
  // An OBS source may not share the browser's saved settings: the custom colours go along.
  if (settings.theme === CUSTOM_THEME) {
    const { bg, text, accent } = settings.customTheme;
    params.set('colors', [bg, text, accent].map((hex) => hex.slice(1)).join(','));
  }
  params.set('lang', settings.language);
  if (settings.chromaKey.enabled) {
    params.set('transparent', '1');
    if (settings.transparency !== DEFAULT_SETTINGS.transparency) params.set('transparency', String(settings.transparency));
  }
  if (settings.refreshRate !== DEFAULT_SETTINGS.refreshRate) params.set('fps', String(settings.refreshRate));
  if (settings.gameIconSize !== DEFAULT_SETTINGS.gameIconSize) params.set('gameicon', String(settings.gameIconSize));
  if (settings.splitIconSize !== DEFAULT_SETTINGS.splitIconSize) params.set('spliticon', String(settings.splitIconSize));
  if (settings.streamMode) params.set('stream', '1');
  if (settings.alwaysExpandedSplits) params.set('expanded', '1');
  if (!settings.hotkeysEnabled) params.set('hotkeys', '0');
  if (path === '/' || path === '') {
    const hidden = OVERLAY_SECTIONS.filter((section) => !settings[SECTION_SETTING[section]]);
    if (hidden.length > 0) params.set('hide', hidden.join(','));
    if (!isDefaultSectionOrder(settings.sectionOrder)) params.set('order', settings.sectionOrder.join(','));
  }
  const query = params.toString().replace(/%2C/g, ',');
  const page = path === '/' || path === '' ? '/' : trailingSlash ? `${path}/` : path;
  return `${origin}${basePath}${page}${query ? `?${query}` : ''}`;
}
