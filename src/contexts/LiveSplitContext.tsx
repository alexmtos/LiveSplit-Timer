'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectionStatus, LiveSplitCommand, LiveSplitState, RunMetadata, TimingMethod } from '@/types';
import { useSettings } from './SettingsContext';
import { parseServerMessage } from '@/lib/state';
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
/** The server broadcasts every 15 s; after this long without traffic we ping it. */
const IDLE_PING_MS = 20_000;
/** ...and after this long we assume the connection is dead and reconnect. */
const IDLE_RECONNECT_MS = 45_000;
/** Time to wait for the first state before suspecting the wrong server. */
const FIRST_STATE_TIMEOUT_MS = 4_000;
/** Game time can pause without any event (load removal), so poll while it matters. */
const GAME_TIME_SYNC_MS = 1_000;
const WR_RETRY_MS = 60_000;

export type WorldRecordStatus =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; record: WorldRecord | null };

interface LiveSnapshot {
  url: string;
  state: LiveSplitState;
  anchor: TimeAnchor;
  /** performance.now() when the run entered "Ended"; guards against accidental resets. */
  endedAt: number | null;
}

interface LiveSplitContextType {
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  /** The connection failed or dropped and the app is retrying in the background. */
  isRetrying: boolean;
  /** Connected, but the server is not LiveSplit.WebSocketServer (e.g. LiveSplit's built-in server). */
  protocolWarning: boolean;
  state: LiveSplitState | null;
  anchor: TimeAnchor | null;
  endedAt: number | null;
  timingMethod: TimingMethod;
  comparison: string;
  sendCommand: (command: LiveSplitCommand) => boolean;
  worldRecord: WorldRecordStatus;
}

const LiveSplitContext = createContext<LiveSplitContextType | undefined>(undefined);

export function LiveSplitProvider({ children }: { children: React.ReactNode }) {
  const { settings, isLoaded } = useSettings();
  const url = settings.wsUrl;

  const [connection, setConnection] = useState<{
    url: string;
    status: ConnectionStatus;
    protocolWarning: boolean;
    /** Consecutive failed attempts; > 0 while retrying after a failure. */
    failures: number;
  }>({ url: '', status: 'idle', protocolWarning: false, failures: 0 });
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const metadataRef = useRef<RunMetadata | null>(null);

  const sendCommand = useCallback((command: LiveSplitCommand) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(command);
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
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const update = (status: ConnectionStatus, protocolWarning = false) => {
      if (!disposed) setConnection({ url, status, protocolWarning, failures: attempt });
    };

    const handleMessage = (data: unknown) => {
      lastMessageAt = performance.now();
      const message = parseServerMessage(data);
      if (message.kind === 'text') {
        update('connected', true);
        return;
      }
      if (message.kind !== 'state') return;
      if (!gotState) {
        gotState = true;
        update('connected', false);
      }
      const next = message.state;
      metadataRef.current = next.run.metadata;
      const receivedAt = performance.now();
      setSnapshot((prev) => {
        const sameSource = prev?.url === url;
        const wasEnded = sameSource && prev.state.timerState === 'Ended';
        return {
          url,
          state: next,
          anchor: { phase: next.timerState, time: next.currentTime, isGameTimePaused: next.isGameTimePaused, receivedAt },
          endedAt: next.timerState !== 'Ended' ? null : wasEnded ? prev.endedAt : receivedAt,
        };
      });
    };

    const scheduleReconnect = () => {
      const delay = Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
      attempt += 1;
      later(open, delay);
    };

    function open() {
      if (disposed) return;
      update('connecting');
      gotState = false;
      let current: WebSocket;
      try {
        current = new WebSocket(url);
      } catch (error) {
        console.error('Invalid LiveSplit server address', url, error);
        update('disconnected');
        scheduleReconnect();
        return;
      }
      socket = current;
      socketRef.current = current;

      later(() => {
        if (current.readyState === WebSocket.CONNECTING) current.close();
      }, CONNECT_TIMEOUT_MS);

      current.onopen = () => {
        attempt = 0;
        lastMessageAt = performance.now();
        update('connected');
        // The server sends the state on connect; if it doesn't, ask once and
        // then warn that this is probably not LiveSplit.WebSocketServer.
        later(() => {
          if (gotState || current.readyState !== WebSocket.OPEN) return;
          current.send('state');
          later(() => {
            if (!gotState && current.readyState === WebSocket.OPEN) update('connected', true);
          }, FIRST_STATE_TIMEOUT_MS);
        }, FIRST_STATE_TIMEOUT_MS);
      };
      current.onmessage = (event) => handleMessage(event.data);
      current.onclose = () => {
        if (socketRef.current === current) socketRef.current = null;
        if (disposed) return;
        update('disconnected');
        scheduleReconnect();
      };
    }

    const watchdog = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const idle = performance.now() - lastMessageAt;
      if (idle > IDLE_RECONNECT_MS) socket.close();
      else if (idle > IDLE_PING_MS) socket.send('hi');
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
  }, [url, isLoaded]);

  const live = snapshot?.url === url ? snapshot : null;
  const state = live?.state ?? null;
  const timingMethod: TimingMethod = state?.currentTimingMethod ?? 'RealTime';
  const comparison = state ? resolveComparison(state) : 'Personal Best';
  const status = connection.url === url ? connection.status : 'connecting';
  const isConnected = status === 'connected';
  const isRetrying = status === 'disconnected' || (status === 'connecting' && connection.url === url && connection.failures > 0);

  // Keep game time accurate: loads pause it without the server sending an event.
  const needsGameTimeSync = isConnected && state?.timerState === 'Running' && timingMethod === 'GameTime';
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
      protocolWarning: connection.url === url && connection.protocolWarning,
      state,
      anchor: live?.anchor ?? null,
      endedAt: live?.endedAt ?? null,
      timingMethod,
      comparison,
      sendCommand,
      worldRecord,
    }),
    [status, isConnected, isRetrying, connection, url, state, live, timingMethod, comparison, sendCommand, worldRecord],
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
