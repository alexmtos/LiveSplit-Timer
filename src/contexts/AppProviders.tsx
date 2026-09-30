'use client';

import React from 'react';
import { SettingsProvider } from './SettingsContext';
import { LiveSplitProvider } from './LiveSplitContext';
import { RunControlsProvider } from './RunControlsContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <LiveSplitProvider>
        <RunControlsProvider>{children}</RunControlsProvider>
      </LiveSplitProvider>
    </SettingsProvider>
  );
}
