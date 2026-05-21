'use client';

import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useHotkeys } from 'react-hotkeys-hook';

export function useLiveSplitHotkeys() {
  const { sendCommand, isConnected, runData } = useLiveSplit();
  const timerState = runData?.timerState || 'NotRunning';

  useHotkeys('space', (e) => {
    e.preventDefault();
    if (!isConnected) return;
    if (timerState === 'Ended') sendCommand('reset');
    else if (timerState === 'Running') sendCommand('split');
    else if (timerState === 'Paused') sendCommand('resume');
    else sendCommand('starttimer');
  }, [isConnected, timerState, sendCommand]);

  useHotkeys('r', () => {
    if (isConnected && confirm('Reset timer?')) sendCommand('reset');
  }, [isConnected, sendCommand]);

  useHotkeys('p', () => {
    if (isConnected && timerState === 'Running') sendCommand('pause');
  }, [isConnected, timerState, sendCommand]);

  useHotkeys('u', () => {
    if (isConnected) sendCommand('unsplit');
  }, [isConnected, sendCommand]);

  useHotkeys('k', () => {
    if (isConnected) sendCommand('skipsplit');
  }, [isConnected, sendCommand]);
}
