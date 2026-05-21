'use client';

import { useState, useEffect, useRef } from 'react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';

export function useTimer() {
  const { runData } = useLiveSplit();
  const [displayTime, setDisplayTime] = useState(0);
  const requestRef = useRef<number | null>(null);

  const timerState = runData?.timerState || 'NotRunning';
  const lastTime = runData?.currentTime?.realTime || 0;
  const lastTs = useRef<number>(performance.now());

  useEffect(() => {
    lastTs.current = performance.now();
  }, [lastTime]);

  useEffect(() => {
    const animate = (time: number) => {
      if (timerState === 'Running') {
        const elapsed = lastTime + (time - lastTs.current);
        setDisplayTime(elapsed);
      } else {
        setDisplayTime(lastTime);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [timerState, lastTime]);

  return {
    time: displayTime,
    formatted: formatTime(displayTime),
    timerState
  };
}

export function formatTime(ms: number) {
  const a = Math.abs(ms);
  const seconds = Math.floor((a % 60000) / 1000);
  const minutes = Math.floor((a % 3600000) / 60000);
  const hours = Math.floor(a / 3600000);
  const centiseconds = Math.floor((a % 1000) / 10);

  const timePart = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const msPart = centiseconds.toString().padStart(2, '0');

  return { timePart, msPart, sign: ms < 0 ? '-' : '' };
}

export function formatDelta(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return '-';
  const { timePart, msPart, sign } = formatTime(ms);
  // For delta we usually want one decimal for milliseconds if it's small,
  // but let's stick to a consistent format for now
  return `${sign}${timePart}.${msPart[0]}`;
}
