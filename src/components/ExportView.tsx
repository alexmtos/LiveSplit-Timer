'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { ComparisonGraph } from './ComparisonGraph';
import { Header } from './Header';
import { Predictions } from './Predictions';
import { SplitsTable } from './SplitsTable';
import { TimerDisplay } from './TimerDisplay';

/** Width of the exported image, in CSS pixels. */
export const EXPORT_WIDTH = 500;
const EXPORT_GRAPH_HEIGHT = 300;
/** Frames to wait so the graph has measured itself and drawn before the capture. */
const SETTLE_FRAMES = 6;

interface PreparedExport {
  element: HTMLElement;
  done: () => void;
}

const ExportViewContext = createContext<(() => Promise<PreparedExport>) | null>(null);

/**
 * Renders, off screen and only while exporting, a fixed-width copy of the
 * overlay with every split section open, a taller graph and no controls, so
 * the image shows the whole run whatever the window size.
 */
export function ExportViewProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [active, setActive] = useState(false);
  const pending = useRef<((element: HTMLElement) => void) | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    const resolve = pending.current;
    if (!active || !element || !resolve) return;
    pending.current = null;
    let frames = 0;
    let id = 0;
    const wait = () => {
      if (++frames >= SETTLE_FRAMES) resolve(element);
      else id = requestAnimationFrame(wait);
    };
    id = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(id);
  }, [active]);

  const prepare = useCallback(
    () =>
      new Promise<PreparedExport>((resolve) => {
        pending.current = (element) => resolve({ element, done: () => setActive(false) });
        setActive(true);
      }),
    [],
  );

  const value = useMemo(() => prepare, [prepare]);

  return (
    <ExportViewContext.Provider value={value}>
      {children}
      {active && (
        <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden data-export-ignore>
          <div ref={ref} className="flex flex-col bg-[var(--bg-main)] font-sans text-white" style={{ width: EXPORT_WIDTH }}>
            {settings.showHeader && <Header />}
            {settings.showTimer && <TimerDisplay />}
            {settings.showPredictions && <Predictions />}
            {settings.showGraph && <ComparisonGraph fixedHeight={EXPORT_GRAPH_HEIGHT} />}
            {settings.showTable && <SplitsTable printable />}
          </div>
        </div>
      )}
    </ExportViewContext.Provider>
  );
}

export function useExportView() {
  return useContext(ExportViewContext);
}
