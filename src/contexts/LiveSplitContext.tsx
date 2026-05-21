'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RunData } from '@/types';
import { useSettings } from './SettingsContext';

interface LiveSplitContextType {
  runData: RunData | null;
  isConnected: boolean;
  isConnecting: boolean;
  sendCommand: (command: string) => void;
  bestPossibleTime: number | null;
  predictedTime: number | null;
  worldRecord: {
    timeMs: number | null;
    player: string | null;
    url: string | null;
  } | null;
}

const LiveSplitContext = createContext<LiveSplitContextType | undefined>(undefined);

export function LiveSplitProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [runData, setRunData] = useState<RunData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bestPossibleTime, setBestPossibleTime] = useState<number | null>(null);
  const [predictedTime, setPredictedTime] = useState<number | null>(null);
  const [worldRecord, setWorldRecord] = useState<LiveSplitContextType['worldRecord']>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastCommand = useRef<string | null>(null);

  const fetchWorldRecord = useCallback(async (gameId: string, categoryId: string) => {
    try {
      const response = await fetch(`https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${categoryId}?top=1&embed=players`);
      if (!response.ok) return;
      const data = await response.json();
      const run = data.data.runs[0];
      if (!run) return;

      const timeMs = parseISODuration(run.run.times.primary);
      const player = data.data.players.data[0]?.names.international || 'Unknown';

      setWorldRecord({
        timeMs,
        player,
        url: run.run.weblink
      });
    } catch (e) {
      console.error('Failed to fetch WR', e);
    }
  }, []);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

    setIsConnecting(true);
    const socket = new WebSocket(settings.wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      console.log('Connected to LiveSplit Server');
    };

    socket.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      console.log('Disconnected from LiveSplit Server');
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
      socket.close();
    };

    socket.onmessage = (event) => {
      try {
        const message = event.data.trim();

        try {
          const data = JSON.parse(message);
          const timerData = data.state || data;
          if (timerData && typeof timerData === 'object') {
            setRunData(timerData);

            // Check for gameId/categoryId to fetch WR
            const metadata = timerData.run?.metadata;
            if (metadata?.gameId && metadata?.categoryId) {
               fetchWorldRecord(metadata.gameId, metadata.categoryId);
            }
            return;
          }
        } catch (e) {
          if (lastCommand.current === 'getbestpossibletime') {
             setBestPossibleTime(parseTime(message));
          } else if (lastCommand.current === 'getpredictedtime Personal Best') {
             setPredictedTime(parseTime(message));
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
  }, [settings.wsUrl, fetchWorldRecord]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  const sendCommand = useCallback((command: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      lastCommand.current = command;
      ws.current.send(command);
    }
  }, []);

  return (
    <LiveSplitContext.Provider value={{ runData, isConnected, isConnecting, sendCommand, bestPossibleTime, predictedTime, worldRecord }}>
      {children}
    </LiveSplitContext.Provider>
  );
}

export function useLiveSplit() {
  const context = useContext(LiveSplitContext);
  if (context === undefined) {
    throw new Error('useLiveSplit must be used within a LiveSplitProvider');
  }
  return context;
}

function parseTime(timeString: string): number | null {
  if (!timeString || timeString === '-') return null;
  const numeric = parseFloat(timeString);
  if (!isNaN(numeric)) return numeric * 1000;
  try {
    const [main, csStr] = timeString.split('.');
    const parts = main.split(':').reverse();
    let seconds = 0;
    if (parts[0]) seconds += parseFloat(parts[0]);
    if (parts[1]) seconds += parseFloat(parts[1]) * 60;
    if (parts[2]) seconds += parseFloat(parts[2]) * 3600;
    let ms = seconds * 1000;
    if (csStr) ms += parseFloat(csStr) * 10;
    return ms;
  } catch (e) {
    return null;
  }
}

function parseISODuration(duration: string): number {
  // Simple ISO 8601 duration parser (PT1H2M3S)
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/;
  const matches = duration.match(regex);
  if (!matches) return 0;
  const hours = parseInt(matches[1] || '0');
  const minutes = parseInt(matches[2] || '0');
  const seconds = parseFloat(matches[3] || '0');
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
