'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, FileText, Image as ImageIcon, Trash2, X } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useExport } from '@/hooks/useExport';
import { useI18n } from '@/hooks/useI18n';
import { buildWsUrl, isBlockedByMixedContent, parseWsUrl, testWebSocket } from '@/lib/connection';
import { THEME_COLORS } from '@/lib/themes';
import { LANGUAGE_OPTIONS, type TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';
import type { Settings } from '@/types';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '';
const CONFIRM_WINDOW_MS = 3_000;

type BooleanSetting = 'showControls' | 'showGraph' | 'showTable' | 'alwaysExpandedSplits' | 'hotkeysEnabled';

const TOGGLES: { key: BooleanSetting; title: TranslationKey; desc: TranslationKey }[] = [
  { key: 'showControls', title: 'display_controls', desc: 'display_controls_desc' },
  { key: 'showGraph', title: 'display_graph', desc: 'display_graph_desc' },
  { key: 'showTable', title: 'display_table', desc: 'display_table_desc' },
  { key: 'alwaysExpandedSplits', title: 'display_expanded', desc: 'display_expanded_desc' },
  { key: 'hotkeysEnabled', title: 'display_hotkeys', desc: 'display_hotkeys_desc' },
];

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: () => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-white/10',
      )}
    >
      <span
        className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-md transition-all', checked ? 'left-6' : 'left-1')}
      />
    </button>
  );
}

function SettingRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <div>
        <h4 id={id} className="text-sm font-semibold text-white">
          {title}
        </h4>
        <p className="text-[11px] text-[var(--text-dim)]">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

type TestResult = 'idle' | 'testing' | 'success' | 'failed' | 'invalid';

function ConnectionSection() {
  const { settings, updateSettings } = useSettings();
  const { status, protocolWarning } = useLiveSplit();
  const { t } = useI18n();
  const initial = parseWsUrl(settings.wsUrl);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [result, setResult] = useState<TestResult>('idle');
  const [pageProtocol, setPageProtocol] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window is only available after mount
    setPageProtocol(window.location.protocol);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = buildWsUrl(host, port, initial.secure);
    if (!url) {
      setResult('invalid');
      return;
    }
    setResult('testing');
    const ok = await testWebSocket(url);
    updateSettings({ wsUrl: url });
    const saved = parseWsUrl(url);
    setHost(saved.host);
    setPort(saved.port);
    setResult(ok ? 'success' : 'failed');
  };

  const statusKey: TranslationKey =
    status === 'connected' ? 'connection_status' : status === 'disconnected' ? 'connection_disconnected' : 'connection_connecting';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold uppercase tracking-wider text-accent">{t('connection_title')}</h3>
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5" role="status">
          <span
            className={cn(
              'h-2 w-2 rounded-full transition-all',
              status === 'connected'
                ? protocolWarning
                  ? 'bg-amber-500'
                  : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                : status === 'disconnected'
                  ? 'bg-red-500'
                  : 'animate-pulse bg-amber-500',
            )}
          />
          <span className="text-xs text-[var(--text-dim)]">{t(statusKey)}</span>
        </div>
      </div>

      <form onSubmit={submit} className="grid grid-cols-[1fr_90px_auto] items-end gap-3">
        <label className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t('connection_ip')}</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={host}
            onChange={(e) => {
              setHost(e.target.value);
              setResult('idle');
            }}
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white transition-all focus:border-accent focus:outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t('connection_port')}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={port}
            onChange={(e) => {
              setPort(e.target.value.replace(/\D/g, '').slice(0, 5));
              setResult('idle');
            }}
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white transition-all focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={result === 'testing'}
          className="h-[38px] rounded-md border border-accent/30 bg-accent/15 px-4 text-xs font-bold text-accent transition-all hover:bg-accent/25 disabled:opacity-50"
        >
          {result === 'testing' ? t('connection_testing') : t('connection_test')}
        </button>
      </form>

      {result === 'success' && <p className="text-xs text-green-400">{t('connection_test_success')}</p>}
      {result === 'failed' && <p className="text-xs text-red-400">{t('connection_test_failed')}</p>}
      {result === 'invalid' && <p className="text-xs text-red-400">{t('connection_invalid')}</p>}

      {protocolWarning && (
        <p className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('connection_protocol_warning')}
        </p>
      )}
      {isBlockedByMixedContent(settings.wsUrl, pageProtocol) && (
        <p className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('connection_mixed_content')}
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">{t('connection_help')}</p>
    </section>
  );
}

function LanguagePicker() {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGE_OPTIONS.find((l) => l.code === settings.language) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language_label')}
        className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 transition-all hover:bg-white/10"
      >
        <span className="text-lg">{current.flag}</span>
        <span className="text-xs font-bold uppercase text-white">{current.code}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('language_label')}
          className="absolute left-0 top-full z-[60] mt-2 w-56 rounded-lg border border-white/10 bg-[var(--bg-main)] p-2 shadow-xl"
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                role="option"
                aria-selected={settings.language === lang.code}
                onClick={() => {
                  updateSettings({ language: lang.code });
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/5',
                  settings.language === lang.code && 'bg-accent/15',
                )}
              >
                <span>{lang.flag}</span>
                <span className="text-sm text-white">{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { t } = useI18n();
  const { exportCSV, exportImage, canExport } = useExport();
  const [exportFailed, setExportFailed] = useState(false);
  const [confirmResetAt, setConfirmResetAt] = useState<number | null>(null);
  // Bumped on "reset settings" so the connection form reloads the default address.
  const [formGeneration, setFormGeneration] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (confirmResetAt === null) return;
    const id = setTimeout(() => setConfirmResetAt(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(id);
  }, [confirmResetAt]);

  const toggle = (key: BooleanSetting) => updateSettings({ [key]: !settings[key] } as Partial<Settings>);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-export-ignore
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-[var(--bg-main)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-4">
            <LanguagePicker />
            <h2 id={titleId} className="text-xl font-bold text-accent">
              {t('settings_title')}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('settings_close')}
            title={t('settings_close')}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition-all hover:border-red-500 hover:bg-red-500/10 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <ConnectionSection key={formGeneration} />

          <section className="space-y-4">
            <h3 className="text-base font-semibold uppercase tracking-wider text-accent">{t('theme_title')}</h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(THEME_COLORS).map(([themeId, colors]) => (
                <button
                  key={themeId}
                  type="button"
                  aria-pressed={settings.theme === themeId}
                  onClick={() => updateSettings({ theme: themeId })}
                  className={cn(
                    'relative flex h-14 flex-col items-center justify-center overflow-hidden rounded-lg border-2 transition-all',
                    settings.theme === themeId ? 'border-accent' : 'border-white/10 hover:border-white/30',
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg} 50%, ${colors.accent} 50%, ${colors.accent} 100%)`,
                  }}
                >
                  <span className="relative z-10 text-[10px] font-bold uppercase text-white drop-shadow-md">
                    {t(`theme_${themeId}` as TranslationKey)}
                  </span>
                </button>
              ))}
            </div>
            <SettingRow
              title={t('theme_transparent')}
              desc={t('theme_transparent_desc')}
              checked={settings.chromaKey.enabled}
              onChange={() => updateSettings({ chromaKey: { enabled: !settings.chromaKey.enabled } })}
            />
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold uppercase tracking-wider text-accent">{t('display_title')}</h3>
            <div className="space-y-3">
              {TOGGLES.map((opt) => (
                <SettingRow
                  key={opt.key}
                  title={t(opt.title)}
                  desc={t(opt.desc)}
                  checked={settings[opt.key]}
                  onChange={() => toggle(opt.key)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold uppercase tracking-wider text-accent">{t('export_title')}</h3>
            <div className="space-y-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-white/5 p-2">
                  <FileText size={24} className="text-accent" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{t('export_save')}</h4>
                  <p className="text-[11px] text-[var(--text-dim)]">{t('export_desc')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!canExport}
                  onClick={async () => setExportFailed(!(await exportImage()))}
                  className="flex items-center justify-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-bold text-accent transition-all hover:bg-accent/20 disabled:opacity-40"
                >
                  <ImageIcon size={16} />
                  {t('export_image')}
                </button>
                <button
                  type="button"
                  disabled={!canExport}
                  onClick={exportCSV}
                  className="flex items-center justify-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-xs font-bold text-green-500 transition-all hover:bg-green-500/20 disabled:opacity-40"
                >
                  <FileText size={16} />
                  {t('export_csv')}
                </button>
              </div>
              {exportFailed && <p className="text-xs text-red-400">{t('export_failed')}</p>}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)]">
              {t('version_label')} {APP_VERSION}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirmResetAt !== null) {
                resetSettings();
                setFormGeneration((n) => n + 1);
                setConfirmResetAt(null);
              } else {
                setConfirmResetAt(Date.now());
              }
            }}
            className={cn(
              'flex items-center gap-2 text-right text-xs font-bold transition-colors',
              confirmResetAt !== null ? 'text-red-400' : 'text-red-500/70 hover:text-red-500',
            )}
          >
            <Trash2 size={14} className="shrink-0" />
            {confirmResetAt !== null ? t('reset_warning') : t('reset_button')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // Mounting on open gives the connection form fresh values every time.
  return isOpen ? <SettingsDialog onClose={onClose} /> : null;
}
