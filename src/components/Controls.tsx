'use client';

import React from 'react';
import { Flag, Lock, Pause, Play, RotateCcw, SkipForward, Undo2 } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunControls } from '@/contexts/RunControlsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

// Mouse clicks must not leave focus on a button: a later Space press would
// click that button again instead of triggering the split hotkey.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const secondaryButton =
  'flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5';

/** `fill`: controls alone on the page (`/controls`), with large touch targets. */
export function Controls({ fill = false }: { fill?: boolean }) {
  const { settings } = useSettings();
  const { state, server } = useLiveSplit();
  const controls = useRunControls();
  const { t } = useI18n();

  const phase = state?.timerState ?? 'NotRunning';
  const primaryLabel =
    phase === 'Ended' ? t('btn_reset') : phase === 'Running' ? t('btn_split') : phase === 'Paused' ? t('btn_resume') : t('btn_start');
  const pauseLabel = phase === 'Paused' ? t('btn_resume') : t('btn_pause');
  const withKey = (label: string, key: string) => (settings.hotkeysEnabled ? `${label} (${key})` : label);
  const primaryIcon = (size: number) =>
    phase === 'Ended' ? (
      <RotateCcw size={size} />
    ) : phase === 'Running' ? (
      <Flag size={size} fill="currentColor" />
    ) : (
      <Play size={size} fill="currentColor" />
    );

  if (server?.readOnly) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center gap-2 border-b border-white/10 bg-black/20 px-4 text-xs text-[var(--text-dim)]',
          fill ? 'flex-1 border-b-0 text-base' : 'h-[60px]',
        )}
        data-export-ignore
      >
        <Lock size={fill ? 18 : 14} />
        {t('controls_read_only')}
      </div>
    );
  }

  if (fill) {
    const big = 'flex items-center justify-center gap-3 rounded-xl border text-lg font-bold text-white transition-all disabled:opacity-30';
    const secondary = [
      { label: pauseLabel, enabled: controls.canTogglePause, onClick: controls.togglePause, icon: phase === 'Paused' ? <Play size={28} fill="currentColor" /> : <Pause size={28} fill="currentColor" /> },
      { label: t('btn_skip'), enabled: controls.canSkip, onClick: controls.skip, icon: <SkipForward size={28} /> },
      { label: t('btn_undo'), enabled: controls.canUndo, onClick: controls.undo, icon: <Undo2 size={28} /> },
      { label: controls.resetArmed ? t('reset_confirm_hint') : t('btn_reset'), enabled: controls.canReset, onClick: controls.requestReset, icon: <RotateCcw size={28} />, danger: controls.resetArmed },
    ];
    return (
      <div className="grid flex-1 grid-rows-[2fr_1fr] gap-3 p-4 pt-14" data-export-ignore>
        <button
          type="button"
          disabled={!controls.canPrimary}
          onMouseDown={keepFocus}
          onClick={controls.primary}
          className={cn(big, phase === 'Ended' ? 'border-red-500 bg-red-500' : 'border-accent bg-accent text-[color:var(--accent-fg)] active:brightness-90')}
        >
          {primaryIcon(40)}
          {primaryLabel}
        </button>
        <div className="grid grid-cols-4 gap-3">
          {secondary.map((b, i) => (
            <button
              key={i}
              type="button"
              disabled={!b.enabled}
              onMouseDown={keepFocus}
              onClick={b.onClick}
              aria-label={b.label}
              title={b.label}
              className={cn(
                big,
                'border-white/10 bg-white/5 active:bg-white/15',
                b.danger && 'animate-pulse border-red-500 bg-red-500/30',
              )}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/20 p-3 px-4"
      data-export-ignore
    >
      <div className="flex flex-1 justify-start">
        <button
          type="button"
          disabled={!controls.canPrimary}
          onMouseDown={keepFocus}
          onClick={controls.primary}
          aria-label={primaryLabel}
          title={withKey(primaryLabel, 'Space')}
          className={cn(
            'flex h-11 min-w-[44px] items-center justify-center rounded-lg border px-3 text-white transition-all disabled:opacity-30',
            phase === 'Ended'
              ? 'border-red-500 bg-red-500'
              : 'border-accent bg-accent text-[color:var(--accent-fg)] hover:brightness-110',
          )}
        >
          {primaryIcon(20)}
        </button>
      </div>

      <div className="flex flex-[2] justify-center gap-2">
        <button
          type="button"
          disabled={!controls.canTogglePause}
          onMouseDown={keepFocus}
          onClick={controls.togglePause}
          aria-label={pauseLabel}
          title={withKey(pauseLabel, 'P')}
          className={secondaryButton}
        >
          {phase === 'Paused' ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
        </button>
        <button
          type="button"
          disabled={!controls.canSkip}
          onMouseDown={keepFocus}
          onClick={controls.skip}
          aria-label={t('btn_skip')}
          title={withKey(t('btn_skip'), 'K')}
          className={secondaryButton}
        >
          <SkipForward size={18} />
        </button>
        <button
          type="button"
          disabled={!controls.canUndo}
          onMouseDown={keepFocus}
          onClick={controls.undo}
          aria-label={t('btn_undo')}
          title={withKey(t('btn_undo'), 'U')}
          className={secondaryButton}
        >
          <Undo2 size={18} />
        </button>
      </div>

      <div className="flex flex-1 justify-end">
        <button
          type="button"
          disabled={!controls.canReset}
          onMouseDown={keepFocus}
          onClick={controls.requestReset}
          aria-label={t('btn_reset')}
          title={controls.resetArmed ? t('reset_confirm_hint') : withKey(t('btn_reset'), 'R')}
          className={cn(
            secondaryButton,
            controls.resetArmed && 'animate-pulse border-red-500 bg-red-500/30 text-red-100 hover:bg-red-500/40',
          )}
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
