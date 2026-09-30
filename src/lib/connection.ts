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

/** Opens a throwaway socket to check whether something answers at `url`. */
export function testWebSocket(url: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      resolve(false);
      return;
    }
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      socket.onopen = socket.onerror = socket.onclose = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.onopen = () => finish(true);
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
  });
}

/** Browsers block `ws://` from pages served over HTTPS. */
export function isBlockedByMixedContent(url: string, pageProtocol: string): boolean {
  return pageProtocol === 'https:' && url.startsWith('ws://');
}
