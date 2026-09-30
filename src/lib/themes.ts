export interface ThemeColors {
  bg: string;
  text: string;
  accent: string;
  accentRgb: string;
}

export const THEME_COLORS: Record<string, ThemeColors> = {
  default: { bg: '#050505', text: '#888', accent: '#00a2ff', accentRgb: '0, 162, 255' },
  dark: { bg: '#0a0a0a', text: '#666', accent: '#4a4a4a', accentRgb: '74, 74, 74' },
  purple: { bg: '#0a050f', text: '#a882d8', accent: '#8a2be2', accentRgb: '138, 43, 226' },
  orange: { bg: '#0f0a05', text: '#d8a882', accent: '#ff8c00', accentRgb: '255, 140, 0' },
  retro: { bg: '#000000', text: '#808080', accent: '#00ffff', accentRgb: '0, 255, 255' },
  blue: { bg: '#0d1b2a', text: '#778da9', accent: '#4dabf7', accentRgb: '77, 171, 247' },
  green: { bg: '#0a1f0a', text: '#8ac926', accent: '#38b000', accentRgb: '56, 176, 0' },
  pink: { bg: '#1a0a14', text: '#f48fb1', accent: '#ff6b9d', accentRgb: '255, 107, 157' },
  matrix: { bg: '#000000', text: '#008f11', accent: '#00ff41', accentRgb: '0, 255, 65' },
  sunset: { bg: '#1a0f2e', text: '#d4a5a5', accent: '#ff9a76', accentRgb: '255, 154, 118' },
  midnight: { bg: '#00072d', text: '#5465ff', accent: '#6c5ce7', accentRgb: '108, 92, 231' },
};

export function getTheme(id: string): ThemeColors {
  return THEME_COLORS[id] ?? THEME_COLORS.default;
}

/** Text colour that stays readable on top of the accent colour (WCAG relative luminance). */
export function accentForeground(accentRgb: string): string {
  const [r, g, b] = accentRgb.split(',').map((c) => {
    const v = Number(c) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#000000' : '#ffffff';
}
