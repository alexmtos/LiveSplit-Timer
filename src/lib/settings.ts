import { LANGUAGES, OVERLAY_SECTIONS, SECTION_SETTING, type Language, type OverlaySection, type Settings } from '@/types';
import { DEFAULT_PORT, DEFAULT_WS_URL, buildWsUrl, parseWsUrl } from './connection';
import { THEME_COLORS } from './themes';

export const SETTINGS_STORAGE_KEY = 'livesplit-settings';

export const DEFAULT_SETTINGS: Settings = {
  language: 'pt-BR',
  theme: 'default',
  showHeader: true,
  showTimer: true,
  showPredictions: true,
  showControls: true,
  showGraph: true,
  showTable: true,
  alwaysExpandedSplits: false,
  hotkeysEnabled: true,
  streamMode: false,
  wsUrl: DEFAULT_WS_URL,
  chromaKey: {
    enabled: false,
  },
};

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
    theme: typeof input.theme === 'string' && input.theme in THEME_COLORS ? input.theme : DEFAULT_SETTINGS.theme,
    wsUrl: isWsUrl(input.wsUrl) ? input.wsUrl : DEFAULT_SETTINGS.wsUrl,
    chromaKey: {
      enabled: typeof chroma?.enabled === 'boolean' ? chroma.enabled : DEFAULT_SETTINGS.chromaKey.enabled,
    },
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
    .filter((part): part is OverlaySection => (OVERLAY_SECTIONS as readonly string[]).includes(part));
}

/**
 * Reads settings from the page URL. They apply to this page only and are never
 * saved, so each OBS browser source can have its own configuration:
 *
 *   ?host=192.168.0.10&port=15721&theme=matrix&lang=en-US&transparent=1
 *   &stream=1&hide=controls,graph&expanded=1&hotkeys=0
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

  const theme = params.get('theme');
  if (theme && theme in THEME_COLORS) overrides.theme = theme;

  const lang = params.get('lang');
  const language = lang ? matchLanguage(lang) : null;
  if (language) overrides.language = language;

  const transparent = parseBoolean(params.get('transparent'));
  if (transparent !== undefined) overrides.chromaKey = { enabled: transparent };

  const flags: [string, BooleanKey][] = [
    ['stream', 'streamMode'],
    ['expanded', 'alwaysExpandedSplits'],
    ['hotkeys', 'hotkeysEnabled'],
  ];
  for (const [param, key] of flags) {
    const value = parseBoolean(params.get(param));
    if (value !== undefined) overrides[key] = value;
  }

  for (const section of parseSections(params.get('show'))) overrides[SECTION_SETTING[section] as BooleanKey] = true;
  for (const section of parseSections(params.get('hide'))) overrides[SECTION_SETTING[section] as BooleanKey] = false;

  return overrides;
}

/** Builds a URL that reproduces `settings` for the given page (e.g. "/" or "/timer"). */
export function buildOverlayUrl(origin: string, path: string, settings: Settings): string {
  const params = new URLSearchParams();
  const address = parseWsUrl(settings.wsUrl);
  if (settings.wsUrl !== DEFAULT_WS_URL) {
    params.set('host', address.host);
    params.set('port', address.port);
    if (address.secure) params.set('secure', '1');
  }
  if (settings.theme !== DEFAULT_SETTINGS.theme) params.set('theme', settings.theme);
  params.set('lang', settings.language);
  if (settings.chromaKey.enabled) params.set('transparent', '1');
  if (settings.streamMode) params.set('stream', '1');
  if (settings.alwaysExpandedSplits) params.set('expanded', '1');
  if (!settings.hotkeysEnabled) params.set('hotkeys', '0');
  if (path === '/' || path === '') {
    const hidden = OVERLAY_SECTIONS.filter((section) => !settings[SECTION_SETTING[section]]);
    if (hidden.length > 0) params.set('hide', hidden.join(','));
  }
  const query = params.toString().replace(/%2C/g, ',');
  return `${origin}${path}${query ? `?${query}` : ''}`;
}
