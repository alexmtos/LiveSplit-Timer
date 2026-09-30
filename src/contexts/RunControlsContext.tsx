'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveSplit } from './LiveSplitContext';
import { isRunActive } from '@/lib/run';

/** After the last split, ignore "reset" for a moment so a double press can't throw the run away. */
const END_GUARD_MS = 1_000;
/** A mid-run reset must be confirmed with a second press within this window. */
const RESET_CONFIRM_MS = 3_000;

interface RunControls {
  canPrimary: boolean;
  canTogglePause: boolean;
  canSkip: boolean;
  canUndo: boolean;
  canReset: boolean;
  /** True while waiting for the second press that confirms a reset. */
  resetArmed: boolean;
  primary: () => void;
  togglePause: () => void;
  skip: () => void;
  undo: () => void;
  requestReset: () => void;
}

const RunControlsContext = createContext<RunControls | undefined>(undefined);

export function RunControlsProvider({ children }: { children: React.ReactNode }) {
  const { state, isConnected, sendCommand, endedAt } = useLiveSplit();
  const [unlockedEnd, setUnlockedEnd] = useState<number | null>(null);
  const [armedAt, setArmedAt] = useState<number | null>(null);

  useEffect(() => {
    if (endedAt === null) return;
    const id = setTimeout(() => setUnlockedEnd(endedAt), Math.max(0, endedAt + END_GUARD_MS - performance.now()));
    return () => clearTimeout(id);
  }, [endedAt]);

  useEffect(() => {
    if (armedAt === null) return;
    const id = setTimeout(() => setArmedAt(null), RESET_CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armedAt]);

  const phase = state?.timerState ?? 'NotRunning';
  const index = state?.currentSplitIndex ?? -1;
  const segmentCount = state?.run.segments.length ?? 0;
  const ready = isConnected && segmentCount > 0;
  const active = isRunActive(phase);
  const endLocked = phase === 'Ended' && endedAt !== null && unlockedEnd !== endedAt;

  const canPrimary = ready && !endLocked;
  const canTogglePause = ready && active;
  // LiveSplit can't skip the final split, and there is nothing to undo on the first one.
  const canSkip = ready && active && index < segmentCount - 1;
  const canUndo = ready && (active || phase === 'Ended') && index > 0;
  const canReset = ready && phase !== 'NotRunning' && !endLocked;

  const primary = useCallback(() => {
    if (!canPrimary) return;
    if (phase === 'Ended') sendCommand('reset');
    else if (phase === 'Running') sendCommand('split');
    else if (phase === 'Paused') sendCommand('resume');
    else sendCommand('starttimer');
  }, [canPrimary, phase, sendCommand]);

  const togglePause = useCallback(() => {
    if (!canTogglePause) return;
    sendCommand(phase === 'Paused' ? 'resume' : 'pause');
  }, [canTogglePause, phase, sendCommand]);

  const skip = useCallback(() => {
    if (canSkip) sendCommand('skipsplit');
  }, [canSkip, sendCommand]);

  const undo = useCallback(() => {
    if (canUndo) sendCommand('unsplit');
  }, [canUndo, sendCommand]);

  const requestReset = useCallback(() => {
    if (!canReset) return;
    if (phase === 'Ended' || armedAt !== null) {
      setArmedAt(null);
      sendCommand('reset');
    } else {
      setArmedAt(performance.now());
    }
  }, [canReset, phase, armedAt, sendCommand]);

  const value = useMemo<RunControls>(
    () => ({
      canPrimary,
      canTogglePause,
      canSkip,
      canUndo,
      canReset,
      resetArmed: armedAt !== null && canReset && phase !== 'Ended',
      primary,
      togglePause,
      skip,
      undo,
      requestReset,
    }),
    [canPrimary, canTogglePause, canSkip, canUndo, canReset, armedAt, phase, primary, togglePause, skip, undo, requestReset],
  );

  return <RunControlsContext.Provider value={value}>{children}</RunControlsContext.Provider>;
}

export function useRunControls() {
  const context = useContext(RunControlsContext);
  if (context === undefined) {
    throw new Error('useRunControls must be used within a RunControlsProvider');
  }
  return context;
}
