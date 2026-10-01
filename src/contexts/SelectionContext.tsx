'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveSplit } from './LiveSplitContext';

interface SplitSelection {
  /** Split picked on the graph or in the table; both highlight it. */
  selected: number | null;
  /** Selects a split, or clears the selection when it is already selected. */
  toggle: (split: number) => void;
}

const SelectionContext = createContext<SplitSelection>({ selected: null, toggle: () => {} });

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const { state } = useLiveSplit();
  const [selected, setSelected] = useState<number | null>(null);
  const attempt = `${state?.run.attemptCount ?? ''}|${state?.attemptStarted ?? ''}|${state?.timerState === 'NotRunning'}`;

  // A selection belongs to the attempt it was made in.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived from a new attempt
    setSelected(null);
  }, [attempt]);

  const toggle = useCallback((split: number) => setSelected((current) => (current === split ? null : split)), []);
  const value = useMemo(() => ({ selected, toggle }), [selected, toggle]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSplitSelection() {
  return useContext(SelectionContext);
}
