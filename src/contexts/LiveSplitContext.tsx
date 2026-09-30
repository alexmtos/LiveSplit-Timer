'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommandError,
  ConnectionStatus,
  LiveSplitCommand,
  LiveSplitState,
  RunMetadata,
  ServerInfo,
  TimingMethod,
} from '@/types';
import { useSettings } from './SettingsContext';
import { connectionUrl } from '@/lib/connection';
import { extractIcons, hasIcons, parseServerMessage, withCachedIcons, type IconCache } from '@/lib/state';
import { resolveComparison, type TimeAnchor } from '@/lib/run';
import {
  fetchWorldRecord,
  getCachedWorldRecord,
  setCachedWorldRecord,
  worldRecordKey,
  type WorldRecord,
} from '@/lib/speedrun';

const CONNECT_TIMEOUT_MS = 5_000;
const MAX_RETRY_DELAY_MS = 10_000;
/** The server resends the state every 15 s by default; after this long without traffic we ping it. */
const IDLE_PING_MS = 20_000;
/** ...and after this long we assume the connection is dead and reconnect. */
const IDLE_RECONNECT_MS = 45_000;
/** Time to wait for the first state before suspecting the wrong server. */
const FIRST_STATE_TIMEOUT_MS = 4_000;
/**
 * Protocol 1 only: game time can pause without any event (load removal), so
 * poll while it matters. Protocol 2 sends game-time-paused/resumed events.
 */
const GAME_TIME_SYNC_MS = 3_000;
const WR_RETRY_MS = 60_000;
/** Events after which the run's icons may have changed (protocol 2 events carry no icons). */
const ICON_EVENTS = new Set(['hello', 'run-changed', 'run-manually-modified']);
/** Errors that only mean the timer moved on before the command arrived; not worth showing. */
const SILENT_ERRORS = new Set(['invalid_phase']);

export type WorldRecordStatus =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; record: WorldRecord | null };

interface LiveSnapshot {
  source: string;
  state: LiveSplitState;
  anchor: TimeAnchor;
  /** performance.now() when the run entered "Ended"; guards against accidental resets. */
  endedAt: number | null;
}

export interface CommandFailure extends CommandError {
  /** Date.now() when it happened, so repeated identical errors still show. */
  at: number;
}

interface LiveSplitContextType {
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  /** The connection failed or dropped and the app is retrying in the background. */
  isRetrying: boolean;
  /** Connected, but the server is not LiveSplit.WebSocketServer (e.g. LiveSplit's built-in server). */
  protocolWarning: boolean;
  /** The component refused the token (protocol 2). */
  unauthorized: boolean;
  /** Set once connected: protocol version and, for protocol 2, component details. */
  server: ServerInfo | null;
  state: LiveSplitState | null;
  anchor: TimeAnchor | null;
  endedAt: number | null;
  timingMethod: TimingMethod;
  comparison: string;
  /** Sends an action; `args` are only sent with protocol 2. Returns false when not connected. */
  sendCommand: (command: LiveSplitCommand, args?: Record<string, unknown>) => boolean;
  /** Last command refused by the server (protocol 2). */
  lastError: CommandFailure | null;
  worldRecord: WorldRecordStatus;
}

const LiveSplitContext = createContext<LiveSplitContextType | undefined>(undefined);

interface ConnectionState {
  source: string;
  status: ConnectionStatus;
  protocolWarning: boolean;
  unauthorized: boolean;
  /** Consecutive failed attempts; > 0 while retrying after a failure. */
  failures: number;
  server: ServerInfo | null;
}

export function LiveSplitProvider({ children }: { children: React.ReactNode }) {
  const { settings, isLoaded } = useSettings();
  const url = settings.wsUrl;
  const token = settings.token;
  // A new address or token means a new connection and a new run.
  const source = `${url}\n${token}`;

  const [connection, setConnection] = useState<ConnectionState>({
    source: '',
    status: 'idle',
    protocolWarning: false,
    unauthorized: false,
    failures: 0,
    server: null,
  });
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [lastError, setLastError] = useState<CommandFailure | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const protocolRef = useRef<1 | 2>(1);
  const nextIdRef = useRef(1);
  const metadataRef = useRef<RunMetadata | null>(null);

  const sendCommand = useCallback((command: LiveSplitCommand, args?: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    if (protocolRef.current === 2) {
      socket.send(JSON.stringify({ id: nextIdRef.current++, action: command, ...(args ? { args } : {}) }));
    } else {
      socket.send(command);
    }
    return true;
  }, []);

  useEffect(() => {
    // Don't connect with the default URL before the saved one has been read.
    if (!isLoaded) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let lastMessageAt = 0;
    let gotState = false;
    let server: ServerInfo | null = null;
    let icons: IconCache | null = null;
    /** The socket whose token the server refused. */
    let refusedSocket: WebSocket | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const update = (status: ConnectionStatus, flags: { protocolWarning?: boolean; unauthorized?: boolean } = {}) => {
      if (disposed) return;
      setConnection({
        source,
        status,
        protocolWarning: flags.protocolWarning ?? false,
        unauthorized: flags.unauthorized ?? false,
        failures: attempt,
        server,
      });
    };
    const requestIcons = (target: WebSocket) => {
      if (protocolRef.current === 2 && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({ id: 'icons', action: 'state', args: { includeIcons: true } }));
      }
    };

    const applyState = (incoming: LiveSplitState) => {
      let next = incoming;
      if (protocolRef.current === 2) {
        if (hasIcons(incoming)) icons = extractIcons(incoming);
        next = withCachedIcons(incoming, icons);
      }
      metadataRef.current = next.run.metadata;
      const receivedAt = performance.now();
      setSnapshot((prev) => {
        const wasEnded = prev?.source === source && prev.state.timerState === 'Ended';
        return {
          source,
          state: next,
          anchor: { phase: next.timerState, time: next.currentTime, isGameTimePaused: next.isGameTimePaused, receivedAt },
          endedAt: next.timerState !== 'Ended' ? null : wasEnded ? prev.endedAt : receivedAt,
        };
      });
    };

    const handleMessage = (current: WebSocket, data: unknown) => {
      lastMessageAt = performance.now();
      const message = parseServerMessage(data);
      switch (message.kind) {
        case 'text':
          update('connected', { protocolWarning: true });
          return;
        case 'response':
          if (message.error?.code === 'unauthorized') {
            // The server closes the connection right after; retries keep showing the token problem.
            refusedSocket = current;
            update('disconnected', { unauthorized: true });
            return;
          }
          if (!message.ok && message.error && !SILENT_ERRORS.has(message.error.code)) {
            setLastError({ ...message.error, at: Date.now() });
          }
          return;
        case 'tick': {
          const tick = message.tick;
          const receivedAt = performance.now();
          setSnapshot((prev) =>
            prev?.source === source
              ? {
                  ...prev,
                  state: { ...prev.state, ...tick },
                  anchor: { phase: tick.timerState, time: tick.currentTime, isGameTimePaused: tick.isGameTimePaused, receivedAt },
                }
              : prev,
          );
          return;
        }
        case 'event':
          if (ICON_EVENTS.has(message.event)) requestIcons(current);
          return;
        case 'state': {
          if (!gotState) {
            gotState = true;
            // Only a working session resets the backoff: a server that accepts and
            // immediately drops connections must not be retried every second.
            attempt = 0;
            protocolRef.current = message.hello?.protocolVersion === 2 ? 2 : 1;
            server = message.hello ?? { protocolVersion: 1, componentVersion: null, liveSplitVersion: null, readOnly: false };
            update('connected');
          }
          applyState(message.state);
          if (message.action && ICON_EVENTS.has(message.action)) requestIcons(current);
          return;
        }
      }
    };

    const scheduleReconnect = () => {
      const delay = Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
      attempt += 1;
      later(open, delay);
    };

    function open() {
      if (disposed) return;
      // Keep showing a refused token while retrying, until a connection succeeds.
      update('connecting', { unauthorized: socket !== null && refusedSocket === socket });
      gotState = false;
      server = null;
      icons = null;
      protocolRef.current = 1;
      let current: WebSocket;
      try {
        current = new WebSocket(connectionUrl(url, token));
      } catch (error) {
        console.error('Invalid LiveSplit server address', url, error);
        update('disconnected');
        scheduleReconnect();
        return;
      }
      socket = current;
      socketRef.current = current;
      const refused = () => refusedSocket === current;

      later(() => {
        if (current.readyState === WebSocket.CONNECTING) current.close();
      }, CONNECT_TIMEOUT_MS);

      current.onopen = () => {
        lastMessageAt = performance.now();
        update('connected');
        // The server sends the state on connect; if it doesn't, ask once and
        // then warn that this is probably not LiveSplit.WebSocketServer.
        later(() => {
          if (gotState || refused() || current.readyState !== WebSocket.OPEN) return;
          current.send('state');
          later(() => {
            if (!gotState && !refused() && current.readyState === WebSocket.OPEN) update('connected', { protocolWarning: true });
          }, FIRST_STATE_TIMEOUT_MS);
        }, FIRST_STATE_TIMEOUT_MS);
      };
      current.onmessage = (event) => handleMessage(current, event.data);
      current.onclose = () => {
        if (socketRef.current === current) socketRef.current = null;
        if (disposed) return;
        update('disconnected', { unauthorized: refused() });
        scheduleReconnect();
      };
    }

    const watchdog = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const idle = performance.now() - lastMessageAt;
      if (idle > IDLE_RECONNECT_MS) {
        // A peer that vanished (sleep, cable) can take a minute to finish the
        // close handshake; drop the socket and reconnect right away instead.
        const dead = socket;
        dead.onopen = dead.onmessage = dead.onclose = null;
        dead.close();
        if (socketRef.current === dead) socketRef.current = null;
        socket = null;
        update('disconnected');
        scheduleReconnect();
      } else if (idle > IDLE_PING_MS) {
        socket.send(protocolRef.current === 2 ? JSON.stringify({ action: 'ping' }) : 'hi');
      }
    }, 5_000);

    open();

    return () => {
      disposed = true;
      clearInterval(watchdog);
      timers.forEach(clearTimeout);
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = null;
        socket.close();
      }
      socketRef.current = null;
    };
  }, [source, url, token, isLoaded]);

  const live = snapshot?.source === source ? snapshot : null;
  const state = live?.state ?? null;
  const current = connection.source === source ? connection : null;
  const timingMethod: TimingMethod = state?.currentTimingMethod ?? 'RealTime';
  const comparison = state ? resolveComparison(state) : 'Personal Best';
  const status = current?.status ?? 'connecting';
  const isConnected = status === 'connected';
  const isRetrying = status === 'disconnected' || (status === 'connecting' && (current?.failures ?? 0) > 0);
  const server = isConnected ? (current?.server ?? null) : null;

  // Protocol 1 only: keep game time accurate, loads pause it without an event.
  const needsGameTimeSync =
    isConnected && server?.protocolVersion !== 2 && state?.timerState === 'Running' && timingMethod === 'GameTime';
  useEffect(() => {
    if (!needsGameTimeSync) return;
    const id = setInterval(() => sendCommand('state'), GAME_TIME_SYNC_MS);
    return () => clearInterval(id);
  }, [needsGameTimeSync, sendCommand]);

  const worldRecord = useWorldRecord(worldRecordKey(state?.run.metadata), metadataRef);

  const value = useMemo<LiveSplitContextType>(
    () => ({
      status,
      isConnected,
      isConnecting: status === 'connecting',
      isRetrying,
      protocolWarning: !!current?.protocolWarning,
      unauthorized: !!current?.unauthorized,
      server,
      state,
      anchor: live?.anchor ?? null,
      endedAt: live?.endedAt ?? null,
      timingMethod,
      comparison,
      sendCommand,
      lastError,
      worldRecord,
    }),
    [status, isConnected, isRetrying, current, server, state, live, timingMethod, comparison, sendCommand, lastError, worldRecord],
  );

  return <LiveSplitContext.Provider value={value}>{children}</LiveSplitContext.Provider>;
}

/** Fetches the world record once per game/category/sub-category combination. */
function useWorldRecord(key: string | null, metadataRef: React.RefObject<RunMetadata | null>): WorldRecordStatus {
  const [result, setResult] = useState<{ key: string; value: WorldRecordStatus } | null>(null);

  useEffect(() => {
    const meta = metadataRef.current;
    if (!key || !meta) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      if (controller.signal.aborted) return;
      const cached = getCachedWorldRecord(key);
      if (cached) {
        setResult({ key, value: { status: 'ok', record: cached.record } });
        return;
      }
      try {
        const record = await fetchWorldRecord(meta, { signal: controller.signal });
        setCachedWorldRecord(key, record);
        setResult({ key, value: { status: 'ok', record } });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('Failed to fetch world record', error);
        setResult({ key, value: { status: 'error' } });
        retry = setTimeout(load, WR_RETRY_MS);
      }
    };
    void Promise.resolve().then(load);

    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, [key, metadataRef]);

  if (!key) return { status: 'none' };
  return result?.key === key ? result.value : { status: 'loading' };
}

export function useLiveSplit() {
  const context = useContext(LiveSplitContext);
  if (context === undefined) {
    throw new Error('useLiveSplit must be used within a LiveSplitProvider');
  }
  return context;
}
