import { LANGUAGES, type Language, type Settings } from '@/types';
import { DEFAULT_WS_URL } from './connection';
import { THEME_COLORS } from './themes';

export const SETTINGS_STORAGE_KEY = 'livesplit-settings';

export const DEFAULT_SETTINGS: Settings = {
  language: 'pt-BR',
  theme: 'default',
  showGraph: true,
  showTable: true,
  showControls: true,
  alwaysExpandedSplits: false,
  hotkeysEnabled: true,
  wsUrl: DEFAULT_WS_URL,
  chromaKey: {
    enabled: false,
  },
};

const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** Picks the best supported language from the browser's preferences. */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    if (isLanguage(tag)) return tag;
    const base = tag.toLowerCase().split('-')[0];
    const match = LANGUAGES.find((lang) => lang.toLowerCase().split('-')[0] === base);
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
  const bool = (key: keyof Settings) =>
    typeof input[key] === 'boolean' ? (input[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean);
  const chroma = input.chromaKey as { enabled?: unknown } | undefined;

  return {
    language: isLanguage(input.language) ? input.language : fallbackLanguage,
    theme: typeof input.theme === 'string' && input.theme in THEME_COLORS ? input.theme : DEFAULT_SETTINGS.theme,
    showGraph: bool('showGraph'),
    showTable: bool('showTable'),
    showControls: bool('showControls'),
    alwaysExpandedSplits: bool('alwaysExpandedSplits'),
    hotkeysEnabled: bool('hotkeysEnabled'),
    wsUrl: isWsUrl(input.wsUrl) ? input.wsUrl : DEFAULT_SETTINGS.wsUrl,
    chromaKey: {
      enabled: typeof chroma?.enabled === 'boolean' ? chroma.enabled : DEFAULT_SETTINGS.chromaKey.enabled,
    },
  };
}
