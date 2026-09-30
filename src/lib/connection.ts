import type { ConnectionDiagnostic } from '@/types';
import { GreetingWatcher } from './state';

export const DEFAULT_PORT = '15721';
export const DEFAULT_WS_URL = `ws://localhost:${DEFAULT_PORT}`;

export interface WsAddress {
  host: string;
  port: string;
  secure: boolean;
}

/** Splits a WebSocket URL into the host/port shown in the settings form. */
export function parseWsUrl(url: string): WsAddress {
  try {
    const parsed = new URL(url);
    const secure = parsed.protocol === 'wss:';
    return {
      host: parsed.hostname.replace(/^\[|\]$/g, ''),
      port: parsed.port || (secure ? '443' : '80'),
      secure,
    };
  } catch {
    return { host: 'localhost', port: DEFAULT_PORT, secure: false };
  }
}

/**
 * Builds a WebSocket URL from user input. The host field also accepts a full
 * address ("ws://192.168.0.10:15721", "wss://example.com") for convenience.
 * Returns null when the input is not a valid address.
 */
export function buildWsUrl(hostInput: string, portInput: string, secure = false): string | null {
  let host = hostInput.trim();
  let port = portInput.trim();
  if (!host) return null;

  if (/^wss?:\/\//i.test(host)) {
    try {
      const parsed = new URL(host);
      secure = parsed.protocol === 'wss:';
      host = parsed.hostname.replace(/^\[|\]$/g, '');
      if (parsed.port) port = parsed.port;
    } catch {
      return null;
    }
  }

  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return null;
  const needsBrackets = host.includes(':') && !host.startsWith('[');
  const hostPart = needsBrackets ? `[${host}]` : host;
  const candidate = `${secure ? 'wss' : 'ws'}://${hostPart}:${port}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || /[\s/?#@]/.test(host)) return null;
    return candidate;
  } catch {
    return null;
  }
}

export type TestResult = 'ok' | 'failed' | 'unauthorized' | 'wrong-server';

export interface TestOutcome {
  result: TestResult;
  /** For 'wrong-server': what arrived instead of a timer state. */
  diagnostic: ConnectionDiagnostic | null;
}

/** Time to wait for the greeting before asking for the state once. */
const TEST_STATE_REQUEST_MS = 2000;

/**
 * Opens a throwaway connection and waits for the server's greeting, so a wrong
 * token (component 2.x accepts the socket, then refuses) or a server that does
 * not send a timer state is told apart from a working connection.
 */
export function testConnection(url: string, token = '', timeoutMs = 5000): Promise<TestOutcome> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(connectionUrl(url, token));
    } catch {
      resolve({ result: 'failed', diagnostic: null });
      return;
    }
    const watcher = new GreetingWatcher();
    let opened = false;
    let askTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: TestResult) => {
      clearTimeout(timer);
      clearTimeout(askTimer);
      socket.onopen = socket.onerror = socket.onclose = socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve({ result, diagnostic: result === 'wrong-server' ? watcher.diagnostic() : null });
    };
    const timer = setTimeout(() => finish(opened ? 'wrong-server' : 'failed'), timeoutMs);
    socket.onopen = () => {
      opened = true;
      // Like the app: if no greeting comes, ask for the state once; an error reply explains why.
      askTimer = setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('state');
      }, TEST_STATE_REQUEST_MS);
    };
    socket.onmessage = (event) => {
      const message = watcher.observe(event.data);
      if (message.kind === 'state') finish('ok');
      else if (message.kind === 'response' && message.error?.code === 'unauthorized') finish('unauthorized');
      else if (message.kind === 'text') finish('wrong-server');
    };
    socket.onerror = () => finish('failed');
    socket.onclose = () => finish(opened ? 'wrong-server' : 'failed');
  });
}

/**
 * Browsers block `ws://` from pages served over HTTPS, except to this computer
 * (localhost, 127.0.0.0/8, ::1), which Chrome, Edge, Firefox and OBS allow.
 */
export function isBlockedByMixedContent(url: string, pageProtocol: string): boolean {
  if (pageProtocol !== 'https:' || !url.startsWith('ws://')) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return !(host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '::1');
  } catch {
    return true;
  }
}

/**
 * URL actually opened: asks for protocol version 2 and adds the token when the
 * component requires one. Component 1.x ignores the query string and answers
 * with protocol 1, so the same URL works with both.
 */
export function connectionUrl(wsUrl: string, token = ''): string {
  try {
    const url = new URL(wsUrl);
    url.searchParams.set('protocol', '2');
    if (token.trim()) url.searchParams.set('token', token.trim());
    else url.searchParams.delete('token');
    return url.toString();
  } catch {
    return wsUrl;
  }
}
