'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useRunControls } from '@/contexts/RunControlsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { PauseIcon, ResetIcon, SkipIcon, SplitIcon, StartIcon, UndoIcon } from './icons';
import { SettingsButton, useSettingsButtonPlacement } from './SettingsButton';

// Mouse clicks must not leave focus on a button: a later Space press would
// click that button again instead of triggering the split hotkey.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const secondaryButton =
  'flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 text-white transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-white/5';

/** `fill`: controls alone on the page (`/controls`), with large touch targets. */
export function Controls({ fill = false }: { fill?: boolean }) {
  const { settings } = useSettings();
  const { state, server } = useLiveSplit();
  const controls = useRunControls();
  const { t } = useI18n();
  const buttonHere = useSettingsButtonPlacement() === 'controls';

  const phase = state?.timerState ?? 'NotRunning';
  const ended = phase === 'Ended';
  const primaryLabel =
    ended ? t('btn_reset') : phase === 'Running' ? t('btn_split') : phase === 'Paused' ? t('btn_resume') : t('btn_start');
  const pauseLabel = phase === 'Paused' ? t('btn_resume') : t('btn_pause');
  // Once the run ends the primary button is the reset; a second reset button would be a duplicate.
  const canResetButton = controls.canReset && !ended;
  const withKey = (label: string, key: string) => (settings.hotkeysEnabled ? `${label} (${key})` : label);
  const PrimaryIcon = ended ? ResetIcon : phase === 'Running' ? SplitIcon : StartIcon;
  // Red reset once the run is over; greyed out during the moment after the last split when reset is ignored.
  const primaryStyle = !controls.canPrimary
    ? 'border-white/10 bg-white/5 text-[var(--text-dim)] opacity-30'
    : ended
      ? 'border-behind bg-behind text-white hover:brightness-110'
      : 'border-accent bg-accent text-[color:var(--accent-fg)] hover:brightness-110';

  if (server?.readOnly) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-white/10 px-4 text-xs text-[var(--text-dim)]',
          fill ? 'flex-1 border-b-0 text-base' : 'h-[60px]',
        )}
        data-export-ignore
      >
        <div className="flex flex-1 items-center justify-center gap-2">
          <Lock size={fill ? 18 : 14} />
          {t('controls_read_only')}
        </div>
        <SettingsButton at="controls" layout="keep" />
      </div>
    );
  }

  if (fill) {
    const big = 'flex items-center justify-center gap-3 rounded-xl border text-lg font-bold transition-all disabled:cursor-not-allowed';
    const secondary = [
      { label: pauseLabel, enabled: controls.canTogglePause, onClick: controls.togglePause, Icon: phase === 'Paused' ? StartIcon : PauseIcon },
      { label: t('btn_skip'), enabled: controls.canSkip, onClick: controls.skip, Icon: SkipIcon },
      { label: t('btn_undo'), enabled: controls.canUndo, onClick: controls.undo, Icon: UndoIcon },
      { label: controls.resetArmed ? t('reset_confirm_hint') : t('btn_reset'), enabled: canResetButton, onClick: controls.requestReset, Icon: ResetIcon, danger: controls.resetArmed },
    ];
    return (
      // The settings button gets a strip of its own above the buttons.
      <div className={cn('relative grid flex-1 grid-rows-[2fr_1fr] gap-3 p-4', buttonHere && 'pt-14')} data-export-ignore>
        <SettingsButton at="controls" layout="corner" className="right-4 top-3" />
        <button
          type="button"
          disabled={!controls.canPrimary}
          onMouseDown={keepFocus}
          onClick={controls.primary}
          className={cn(big, primaryStyle, 'active:brightness-90')}
        >
          <PrimaryIcon size={40} />
          {primaryLabel}
        </button>
        <div className="grid grid-cols-4 gap-3">
          {secondary.map(({ label, enabled, onClick, Icon, danger }) => (
            <button
              key={label}
              type="button"
              disabled={!enabled}
              onMouseDown={keepFocus}
              onClick={onClick}
              aria-label={label}
              title={label}
              className={cn(
                big,
                'border-white/10 bg-white/5 text-white active:bg-white/15 disabled:opacity-30',
                danger && 'animate-pulse border-behind bg-behind/30',
              )}
            >
              <Icon size={28} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3"
      role="toolbar"
      aria-label={t('controls_label')}
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
            'flex h-11 min-w-[44px] items-center justify-center rounded-lg border px-2 transition-all disabled:cursor-not-allowed',
            primaryStyle,
          )}
        >
          <PrimaryIcon />
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
          {phase === 'Paused' ? <StartIcon /> : <PauseIcon />}
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
          <SkipIcon />
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
          <UndoIcon />
        </button>
      </div>

      <div className="flex flex-1 justify-end">
        <button
          type="button"
          disabled={!canResetButton}
          onMouseDown={keepFocus}
          onClick={controls.requestReset}
          aria-label={t('btn_reset')}
          title={controls.resetArmed ? t('reset_confirm_hint') : withKey(t('btn_reset'), 'R')}
          className={cn(
            secondaryButton,
            controls.resetArmed && 'animate-pulse border-behind bg-behind/30 text-white hover:bg-behind/40',
          )}
        >
          <ResetIcon />
        </button>
      </div>

      {/* Keeps its room even while hidden in stream mode, so the reset button never moves under the cursor. */}
      <SettingsButton at="controls" layout="keep" />
    </div>
  );
}
