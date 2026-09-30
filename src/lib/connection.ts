import { parseServerMessage } from './state';

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

/**
 * Opens a throwaway connection and waits for the server's greeting, so a wrong
 * token (component 2.x accepts the socket, then refuses) or a server that does
 * not speak this protocol is told apart from a working connection.
 */
export function testConnection(url: string, token = '', timeoutMs = 5000): Promise<TestResult> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(connectionUrl(url, token));
    } catch {
      resolve('failed');
      return;
    }
    let opened = false;
    const finish = (result: TestResult) => {
      clearTimeout(timer);
      socket.onopen = socket.onerror = socket.onclose = socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish(opened ? 'wrong-server' : 'failed'), timeoutMs);
    socket.onopen = () => {
      opened = true;
    };
    socket.onmessage = (event) => {
      const message = parseServerMessage(event.data);
      if (message.kind === 'state') finish('ok');
      else if (message.kind === 'response' && message.error?.code === 'unauthorized') finish('unauthorized');
      else if (message.kind === 'text') finish('wrong-server');
    };
    socket.onerror = () => finish('failed');
    socket.onclose = () => finish('failed');
  });
}

/** Browsers block `ws://` from pages served over HTTPS. */
export function isBlockedByMixedContent(url: string, pageProtocol: string): boolean {
  return pageProtocol === 'https:' && url.startsWith('ws://');
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
