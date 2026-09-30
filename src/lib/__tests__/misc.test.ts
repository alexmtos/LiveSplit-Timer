import { describe, expect, it } from 'vitest';
import { buildWsUrl, isBlockedByMixedContent, parseWsUrl } from '@/lib/connection';
import { csvField, safeFileName, toCsv } from '@/lib/csv';
import { DEFAULT_SETTINGS, detectLanguage, sanitizeSettings } from '@/lib/settings';

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
    expect(isBlockedByMixedContent('ws://localhost:15721', 'https:')).toBe(true);
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
    const settings = sanitizeSettings({ language: 'de', theme: 'matrix', showGraph: false, wsUrl: 'ws://pc:15721', chromaKey: { enabled: true } });
    expect(settings).toMatchObject({ language: 'de', theme: 'matrix', showGraph: false, wsUrl: 'ws://pc:15721', chromaKey: { enabled: true } });
  });
});
