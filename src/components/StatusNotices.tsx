'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, WifiOff } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunControls } from '@/contexts/RunControlsContext';
import { useI18n } from '@/hooks/useI18n';
import type { TranslationKey } from '@/lib/translations';

/** Thin banner under the header for connection problems. */
export function ConnectionNotice() {
  const { status, isRetrying, protocolWarning, diagnostic, unauthorized } = useLiveSplit();
  const { t } = useI18n();

  if (unauthorized) {
    return (
      <div className="flex shrink-0 items-start gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] text-red-300" role="status" data-export-ignore>
        <KeyRound size={12} className="mt-0.5 shrink-0" />
        {t('connection_unauthorized')}
      </div>
    );
  }
  if (isRetrying) {
    return (
      <div className="flex shrink-0 items-start gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] text-red-300" role="status" data-export-ignore>
        <WifiOff size={12} className="mt-0.5 shrink-0" />
        {diagnostic?.reason === 'closed' ? t('connection_closed_early') : `${t('connection_disconnected')} — ${t('connection_connecting')}`}
      </div>
    );
  }
  if (status === 'connected' && protocolWarning) {
    const key: TranslationKey =
      diagnostic?.reason === 'text' ? 'connection_protocol_warning' : diagnostic?.reason === 'closed' ? 'connection_closed_early' : 'connection_no_data';
    return (
      <div className="flex shrink-0 items-start gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-200" role="status" data-export-ignore>
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        {t(key)}
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

const ERROR_TOAST_MS = 4_000;

const ERROR_KEYS: Record<string, TranslationKey> = {
  read_only: 'error_read_only',
  forbidden: 'error_forbidden',
  unsupported: 'error_unsupported',
  unavailable: 'error_unavailable',
  invalid_args: 'error_invalid_args',
};

/** Shows, for a few seconds, why LiveSplit refused the last command (protocol 2). */
export function CommandErrorToast() {
  const { lastError } = useLiveSplit();
  const { t } = useI18n();
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);

  useEffect(() => {
    if (!lastError) return;
    const id = setTimeout(() => setHiddenAt(lastError.at), ERROR_TOAST_MS);
    return () => clearTimeout(id);
  }, [lastError]);

  if (!lastError || hiddenAt === lastError.at) return null;
  const key = ERROR_KEYS[lastError.code];
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-14 z-40 mx-auto w-fit max-w-[90%] rounded-md border border-amber-500/40 bg-black/90 px-4 py-2 text-xs font-semibold text-amber-200 shadow-xl"
      role="alert"
      data-export-ignore
    >
      {key ? t(key) : `${t('error_generic')} (${lastError.code}${lastError.message ? `: ${lastError.message}` : ''})`}
    </div>
  );
}
