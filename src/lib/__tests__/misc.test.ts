import { describe, expect, it } from 'vitest';
import { THEME_IDS, accentForeground, getTheme, toHexColor } from '@/lib/themes';
import { buildWsUrl, connectionUrl, isBlockedByMixedContent, parseWsUrl } from '@/lib/connection';
import { csvField, safeFileName, toCsv } from '@/lib/csv';
import { DEFAULT_SETTINGS, buildOverlayUrl, detectLanguage, parseUrlOverrides, sanitizeSettings } from '@/lib/settings';
import type { Settings } from '@/types';

describe('connection URLs', () => {
  it('builds ws URLs from host and port', () => {
    expect(buildWsUrl('192.168.0.10', '15721')).toBe('ws://192.168.0.10:15721');
    expect(buildWsUrl(' localhost ', '8080')).toBe('ws://localhost:8080');
    expect(buildWsUrl('::1', '15721')).toBe('ws://[::1]:15721');
  });

  it('accepts a full address typed into the host field', () => {
    expect(buildWsUrl('wss://timer.example.com:9000', '15721')).toBe('wss://timer.example.com:9000');
    expect(buildWsUrl('ws://10.0.0.5', '15721')).toBe('ws://10.0.0.5:15721');
  });

  it('rejects invalid input', () => {
    expect(buildWsUrl('', '15721')).toBeNull();
    expect(buildWsUrl('localhost', '')).toBeNull();
    expect(buildWsUrl('localhost', '70000')).toBeNull();
    expect(buildWsUrl('local host', '15721')).toBeNull();
  });

  it('parses stored URLs, including paths and IPv6', () => {
    expect(parseWsUrl('ws://localhost:16834/livesplit')).toEqual({ host: 'localhost', port: '16834', secure: false });
    expect(parseWsUrl('ws://[::1]:15721')).toEqual({ host: '::1', port: '15721', secure: false });
    expect(parseWsUrl('wss://example.com')).toEqual({ host: 'example.com', port: '443', secure: true });
  });

  it('detects mixed content', () => {
    expect(isBlockedByMixedContent('ws://192.168.0.10:15721', 'https:')).toBe(true);
    expect(isBlockedByMixedContent('ws://localhost:15721', 'https:')).toBe(false);
    expect(isBlockedByMixedContent('ws://127.0.0.1:15721', 'https:')).toBe(false);
    expect(isBlockedByMixedContent('ws://[::1]:15721', 'https:')).toBe(false);
    expect(isBlockedByMixedContent('wss://localhost:15721', 'https:')).toBe(false);
    expect(isBlockedByMixedContent('ws://localhost:15721', 'http:')).toBe(false);
  });
});

describe('csv', () => {
  it('escapes separators, quotes and line breaks', () => {
    expect(csvField('Boss; phase 2')).toBe('"Boss; phase 2"');
    expect(csvField('The "Hard" Way')).toBe('"The ""Hard"" Way"');
    expect(csvField('plain')).toBe('plain');
    expect(toCsv([['a', 'b;c'], ['1', '2']])).toBe('a;"b;c"\r\n1;2');
  });

  it('builds safe file names', () => {
    expect(safeFileName('Zelda: Ocarina / Any%?')).toBe('Zelda Ocarina Any%');
    expect(safeFileName('   ')).toBe('run');
  });
});

describe('settings', () => {
  it('detects a supported language from browser preferences', () => {
    expect(detectLanguage(['fr-CA', 'en'])).toBe('fr');
    expect(detectLanguage(['en-GB'])).toBe('en-US');
    expect(detectLanguage(['ja'])).toBe('pt-BR');
  });

  it('drops invalid stored values', () => {
    const settings = sanitizeSettings({ language: 'xx', theme: 'nope', showGraph: 'yes', wsUrl: 'http://x', extra: 1 });
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid stored values', () => {
    const settings = sanitizeSettings({ language: 'de', theme: 'matrix', showGraph: false, wsUrl: 'ws://pc:15721', chromaKey: { enabled: true }, transparency: 35 });
    expect(settings).toMatchObject({ language: 'de', theme: 'matrix', showGraph: false, wsUrl: 'ws://pc:15721', chromaKey: { enabled: true }, transparency: 35 });
    expect(sanitizeSettings({ transparency: -5 }).transparency).toBe(100);
    expect(sanitizeSettings({ refreshRate: 30 }).refreshRate).toBe(30);
    expect(sanitizeSettings({ refreshRate: 1000 }).refreshRate).toBe(60);
    expect(sanitizeSettings({ sectionOrder: ['splits', 'graph', 'splits', 'x', 3] }).sectionOrder).toEqual(['splits', 'graph', 'header', 'timer', 'predictions', 'controls']);
    expect(sanitizeSettings({ sectionOrder: 'splits' }).sectionOrder).toEqual(DEFAULT_SETTINGS.sectionOrder);
  });
});

describe('URL overrides', () => {
  const saved = 'ws://localhost:15721';

  it('reads connection, theme, language and flags', () => {
    expect(
      parseUrlOverrides('?host=192.168.0.10&theme=matrix&lang=en&transparent=1&stream=1&expanded=yes&hotkeys=0', saved),
    ).toEqual({
      wsUrl: 'ws://192.168.0.10:15721',
      theme: 'matrix',
      language: 'en-US',
      chromaKey: { enabled: true },
      streamMode: true,
      alwaysExpandedSplits: true,
      hotkeysEnabled: false,
    });
  });

  it('keeps the saved host when only the port is given', () => {
    expect(parseUrlOverrides('?port=16000', 'ws://pc.local:15721').wsUrl).toBe('ws://pc.local:16000');
  });

  it('accepts a full ws URL', () => {
    expect(parseUrlOverrides('?ws=wss://timer.example.com:9000', saved).wsUrl).toBe('wss://timer.example.com:9000');
  });

  it('hides and shows sections', () => {
    expect(parseUrlOverrides('?hide=controls,graph,table&show=header', saved)).toEqual({
      showControls: false,
      showGraph: false,
      showTable: false,
      showHeader: true,
    });
  });

  it('ignores unknown or invalid values', () => {
    expect(parseUrlOverrides('?theme=nope&lang=xx&transparent=maybe&hide=foo&port=abc&transparency=150', saved)).toEqual({});
    expect(parseUrlOverrides('?transparency=40', saved)).toEqual({ transparency: 40 });
    expect(parseUrlOverrides('?fps=10', saved)).toEqual({ refreshRate: 10 });
    expect(parseUrlOverrides('?fps=45', saved)).toEqual({});
  });

  it('round-trips through buildOverlayUrl', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      wsUrl: 'ws://10.0.0.2:15722',
      theme: 'retro',
      language: 'de' as const,
      streamMode: true,
      showGraph: false,
      chromaKey: { enabled: true },
      transparency: 60,
      refreshRate: 30,
    };
    const url = buildOverlayUrl('http://localhost:3000', '/', settings);
    expect(url).toBe('http://localhost:3000/?host=10.0.0.2&port=15722&theme=retro&lang=de&transparent=1&transparency=60&fps=30&stream=1&hide=graph');
    const search = new URL(url).search;
    expect({ ...DEFAULT_SETTINGS, ...parseUrlOverrides(search, DEFAULT_SETTINGS.wsUrl) }).toEqual(settings);
  });

  it('adds the base path and trailing slash of a static deployment', () => {
    const options = { basePath: '/LiveSplit-Timer', trailingSlash: true };
    expect(buildOverlayUrl('https://a.github.io', '/timer', DEFAULT_SETTINGS, options)).toBe('https://a.github.io/LiveSplit-Timer/timer/?lang=pt-BR');
    expect(buildOverlayUrl('https://a.github.io', '/', DEFAULT_SETTINGS, options)).toBe('https://a.github.io/LiveSplit-Timer/?lang=pt-BR');
  });

  it('omits section visibility and order for single-section pages', () => {
    const url = buildOverlayUrl('http://x', '/timer', { ...DEFAULT_SETTINGS, showTimer: false, sectionOrder: ['splits', 'header', 'timer', 'predictions', 'graph', 'controls'] });
    expect(url).toBe('http://x/timer?lang=pt-BR');
  });

  it('reads the image sizes within their ranges', () => {
    expect(parseUrlOverrides('?gameicon=64&spliticon=32', saved)).toEqual({ gameIconSize: 64, splitIconSize: 32 });
    expect(parseUrlOverrides('?gameicon=500&spliticon=8', saved)).toEqual({});
    const settings = { ...DEFAULT_SETTINGS, gameIconSize: 48, splitIconSize: 30 };
    const url = buildOverlayUrl('http://x', '/splits', settings);
    expect(url).toBe('http://x/splits?lang=pt-BR&gameicon=48&spliticon=30');
    expect({ ...DEFAULT_SETTINGS, ...parseUrlOverrides(new URL(url).search, DEFAULT_SETTINGS.wsUrl) }).toEqual(settings);
    expect(sanitizeSettings({ gameIconSize: 40.4, splitIconSize: 'big' })).toMatchObject({ gameIconSize: 40, splitIconSize: 20 });
  });

  it('reads the section order, completing it with the default order', () => {
    expect(parseUrlOverrides('?order=table,timer,timer,nope', saved)).toEqual({
      sectionOrder: ['splits', 'timer', 'header', 'predictions', 'graph', 'controls'],
    });
    expect(parseUrlOverrides('?order=nope', saved)).toEqual({});
  });

  it('round-trips a moved section and leaves the default order out', () => {
    const settings = { ...DEFAULT_SETTINGS, sectionOrder: ['timer', 'header', 'predictions', 'graph', 'controls', 'splits'] as Settings['sectionOrder'] };
    const url = buildOverlayUrl('http://x', '/', settings);
    expect(url).toBe('http://x/?lang=pt-BR&order=timer,header,predictions,graph,controls,splits');
    expect({ ...DEFAULT_SETTINGS, ...parseUrlOverrides(new URL(url).search, DEFAULT_SETTINGS.wsUrl) }).toEqual(settings);
    expect(buildOverlayUrl('http://x', '/', DEFAULT_SETTINGS)).toBe('http://x/?lang=pt-BR');
  });
});

describe('custom theme', () => {
  it('is the last theme and uses the picked colours', () => {
    expect(THEME_IDS[THEME_IDS.length - 1]).toBe('custom');
    expect(getTheme('custom', { bg: '#000000', text: '#cccccc', accent: '#ff8000' })).toEqual({
      bg: '#000000',
      text: '#cccccc',
      accent: '#ff8000',
      accentRgb: '255, 128, 0',
    });
    expect(getTheme('nope').accent).toBe(getTheme('default').accent);
  });

  it('normalizes hex colours', () => {
    expect(toHexColor('ABC')).toBe('#aabbcc');
    expect(toHexColor('#12aBcD')).toBe('#12abcd');
    expect(toHexColor('#12345')).toBeNull();
    expect(toHexColor('red')).toBeNull();
  });

  it('keeps valid stored colours and drops invalid ones', () => {
    expect(sanitizeSettings({ theme: 'custom', customTheme: { bg: '#111', text: '#222222', accent: '#abcdef' } })).toMatchObject({
      theme: 'custom',
      customTheme: { bg: '#111111', text: '#222222', accent: '#abcdef' },
    });
    expect(sanitizeSettings({ customTheme: { bg: '#111', text: 'x', accent: '#abcdef' } }).customTheme).toEqual(DEFAULT_SETTINGS.customTheme);
  });

  it('carries the colours in the OBS URL', () => {
    const settings = { ...DEFAULT_SETTINGS, theme: 'custom', customTheme: { bg: '#101010', text: '#a0a0a0', accent: '#ff00aa' } };
    const url = buildOverlayUrl('http://x', '/timer', settings);
    expect(url).toBe('http://x/timer?theme=custom&colors=101010,a0a0a0,ff00aa&lang=pt-BR');
    expect({ ...DEFAULT_SETTINGS, ...parseUrlOverrides(new URL(url).search, DEFAULT_SETTINGS.wsUrl) }).toEqual(settings);
    expect(buildOverlayUrl('http://x', '/timer', { ...settings, theme: 'matrix' })).toBe('http://x/timer?theme=matrix&lang=pt-BR');
    expect(parseUrlOverrides('?colors=101010,zzz,ff00aa', 'ws://localhost:15721')).toEqual({});
  });
});

describe('accentForeground', () => {
  it('uses dark text on bright accents and light text on dark ones', () => {
    expect(accentForeground('0, 255, 255')).toBe('#000000');
    expect(accentForeground('0, 162, 255')).toBe('#ffffff');
    expect(accentForeground('108, 92, 231')).toBe('#ffffff');
  });
});

describe('connectionUrl and token', () => {
  it('asks for protocol 2 and adds the token only when set', () => {
    expect(connectionUrl('ws://localhost:15721')).toBe('ws://localhost:15721/?protocol=2');
    expect(connectionUrl('ws://pc:15721', ' s3cr3t ')).toBe('ws://pc:15721/?protocol=2&token=s3cr3t');
  });

  it('reads and writes the token in URLs and saved settings', () => {
    expect(parseUrlOverrides('?token=abc', 'ws://localhost:15721')).toEqual({ token: 'abc' });
    expect(buildOverlayUrl('http://x', '/timer', { ...DEFAULT_SETTINGS, token: 'abc' })).toBe('http://x/timer?token=abc&lang=pt-BR');
    expect(sanitizeSettings({ token: ' abc ' }).token).toBe('abc');
    expect(sanitizeSettings({ token: 42 }).token).toBe('');
  });
});
