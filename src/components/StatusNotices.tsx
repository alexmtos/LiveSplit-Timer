'use client';

import React from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunControls } from '@/contexts/RunControlsContext';
import { useI18n } from '@/hooks/useI18n';

/** Thin banner under the header for connection problems. */
export function ConnectionNotice() {
  const { status, isRetrying, protocolWarning } = useLiveSplit();
  const { t } = useI18n();

  if (isRetrying) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] text-red-300" role="status" data-export-ignore>
        <WifiOff size={12} className="shrink-0" />
        {t('connection_disconnected')} — {t('connection_connecting')}
      </div>
    );
  }
  if (status === 'connected' && protocolWarning) {
    return (
      <div className="flex shrink-0 items-start gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-200" role="status" data-export-ignore>
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        {t('connection_protocol_warning')}
      </div>
    );
  }
  return null;
}

/** Tells the runner a second press is needed, even when the controls are hidden. */
export function ResetConfirmToast() {
  const { resetArmed } = useRunControls();
  const { t } = useI18n();
  if (!resetArmed) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 mx-auto w-fit rounded-md border border-red-500/40 bg-black/90 px-4 py-2 text-xs font-semibold text-red-300 shadow-xl"
      role="alert"
      data-export-ignore
    >
      {t('reset_confirm_hint')}
    </div>
  );
}
