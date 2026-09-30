'use client';

import { useEffect, useRef } from 'react';
import { useRunControls } from '@/contexts/RunControlsContext';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function isActivatable(target: EventTarget | null) {
  return target instanceof HTMLElement && ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName);
}

/**
 * Page-level shortcuts, mainly for using the overlay as a remote control.
 * LiveSplit's own global hotkeys keep working independently of these.
 */
export function useLiveSplitHotkeys(enabled: boolean) {
  const controls = useRunControls();
  const controlsRef = useRef(controls);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Holding a key auto-repeats keydown; one press must be one command.
      if (event.repeat || event.defaultPrevented) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      const c = controlsRef.current;
      if (event.code === 'Space') {
        // Space on a focused button already clicks it.
        if (isActivatable(event.target)) return;
        event.preventDefault();
        c.primary();
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'p':
          c.togglePause();
          break;
        case 'u':
          c.undo();
          break;
        case 'k':
          c.skip();
          break;
        case 'r':
          c.requestReset();
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
