'use client';

import React from 'react';
import { SettingsProvider } from './SettingsContext';
import { LiveSplitProvider } from './LiveSplitContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <LiveSplitProvider>
        {children}
      </LiveSplitProvider>
    </SettingsProvider>
  );
}
