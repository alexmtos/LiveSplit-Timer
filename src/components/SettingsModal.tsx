'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, FileText, Image as ImageIcon, Link2, Upload } from 'lucide-react';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useExport } from '@/hooks/useExport';
import { useI18n } from '@/hooks/useI18n';
import { buildWsUrl, isBlockedByMixedContent, parseWsUrl, testConnection, type TestResult } from '@/lib/connection';
import { buildOverlayUrl } from '@/lib/settings';
import { LANGUAGE_OPTIONS, type TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { OVERLAY_SECTIONS, type ConnectionDiagnostic, type Settings } from '@/types';
import { ThemeSelector } from './ThemeSelector';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '';
/** Settings section, separated from the next one by a line. */
const SECTION = 'relative space-y-4 border-b border-white/10 py-6 last:border-b-0 last:pb-0';
/** After picking a theme, wait this long before stepping aside so the theme can be seen on the overlay. */
const THEME_PREVIEW_DELAY_MS = 2_000;
/** How long the panel stays aside (with a message) before coming back. */
const PEEK_MS = 3_000;

type BooleanSetting =
  | 'showHeader'
  | 'showTimer'
  | 'showPredictions'
  | 'showControls'
  | 'showGraph'
  | 'showTable'
  | 'alwaysExpandedSplits'
  | 'hotkeysEnabled'
  | 'streamMode';

const TOGGLES: { key: BooleanSetting; title: TranslationKey; desc: TranslationKey }[] = [
  { key: 'showHeader', title: 'display_header', desc: 'display_header_desc' },
  { key: 'showTimer', title: 'display_timer', desc: 'display_timer_desc' },
  { key: 'showPredictions', title: 'display_predictions', desc: 'display_predictions_desc' },
  { key: 'showControls', title: 'display_controls', desc: 'display_controls_desc' },
  { key: 'showGraph', title: 'display_graph', desc: 'display_graph_desc' },
  { key: 'showTable', title: 'display_table', desc: 'display_table_desc' },
  { key: 'alwaysExpandedSplits', title: 'display_expanded', desc: 'display_expanded_desc' },
  { key: 'hotkeysEnabled', title: 'display_hotkeys', desc: 'display_hotkeys_desc' },
  { key: 'streamMode', title: 'display_stream', desc: 'display_stream_desc' },
];

/** Protocol 2 only: change LiveSplit's comparison and timing method from here. */
function LiveSplitSection() {
  const { state, server, comparison, timingMethod, sendCommand } = useLiveSplit();
  const { t } = useI18n();
  if (!state || server?.protocolVersion !== 2) return null;
  const disabled = server.readOnly;
  const comparisons = state.run.comparisons.length > 0 ? state.run.comparisons : [comparison];

  return (
    <section className={SECTION}>
      <h3 className="text-base font-semibold text-accent">{t('livesplit_title')}</h3>
      <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">
        {disabled ? t('livesplit_read_only') : t('livesplit_desc')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-[var(--text-dim)]">{t('livesplit_comparison')}</span>
          <select
            value={comparison}
            disabled={disabled}
            onChange={(e) => sendCommand('setcomparison', { comparison: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-white focus:border-accent focus:outline-none disabled:opacity-50"
          >
            {comparisons.map((name) => (
              <option key={name} value={name} className="bg-black">
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[var(--text-dim)]">{t('livesplit_timing')}</span>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-black/30 p-1" role="radiogroup">
            {(['RealTime', 'GameTime'] as const).map((method) => (
              <button
                key={method}
                type="button"
                role="radio"
                aria-checked={timingMethod === method}
                disabled={disabled}
                onClick={() => sendCommand('settimingmethod', { method: method.toLowerCase() })}
                className={cn(
                  'rounded px-2 py-1.5 text-xs font-bold transition-colors disabled:opacity-50',
                  timingMethod === method ? 'bg-accent text-[color:var(--accent-fg)]' : 'text-white/70 hover:bg-white/10',
                )}
              >
                {method === 'RealTime' ? t('livesplit_real_time') : t('livesplit_game_time')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const PAGES: { path: string; label: TranslationKey }[] = [
  { path: '/', label: 'obs_page_full' },
  ...OVERLAY_SECTIONS.map((section) => ({ path: `/${section}`, label: `obs_page_${section}` as TranslationKey })),
];

/** Builds the URL of an overlay page with the current settings, for OBS browser sources. */
function ObsUrlSection() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [path, setPath] = useState('/');
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window is only available after mount
    setOrigin(window.location.origin);
  }, []);

  const url = origin
    ? buildOverlayUrl(origin, path, settings, {
        basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
        trailingSlash: process.env.NEXT_PUBLIC_TRAILING_SLASH === '1',
      })
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className={SECTION}>
      <h3 className="text-base font-semibold text-accent">{t('obs_title')}</h3>
      <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">{t('obs_desc')}</p>
      <div className="flex gap-2">
        <select
          value={path}
          onChange={(e) => setPath(e.target.value)}
          aria-label={t('obs_page')}
          className="rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-white focus:border-accent focus:outline-none"
        >
          {PAGES.map((page) => (
            <option key={page.path} value={page.path} className="bg-black">
              {t(page.label)}
            </option>
          ))}
        </select>
        <input
          readOnly
          value={url}
          aria-label="URL"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-white focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/15 px-3 text-xs font-bold text-accent transition-all hover:bg-accent/25"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('obs_copied') : t('obs_copy')}
        </button>
      </div>
    </section>
  );
}

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: () => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={onChange}
      className={cn(
        'relative h-[26px] w-12 shrink-0 rounded-full border transition-all',
        checked ? 'border-accent bg-accent' : 'border-white/10 bg-white/10',
      )}
    >
      <span
        className={cn(
          'absolute bottom-0.5 left-0.5 h-5 w-5 rounded-full transition-all',
          checked ? 'translate-x-[22px] bg-white' : 'bg-[var(--text-dim)]',
        )}
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
    <div className="flex items-center justify-between gap-5 rounded-lg border border-transparent bg-white/[0.03] p-3 transition-all hover:bg-white/5">
      <div>
        <h4 id={id} className="mb-1 text-sm font-semibold text-white">
          {title}
        </h4>
        <p className="text-xs text-[var(--text-dim)]">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

type FormResult = 'idle' | 'testing' | 'invalid' | TestResult;

const DIAGNOSTIC_TEXT: Record<ConnectionDiagnostic['reason'], TranslationKey> = {
  silent: 'diag_silent',
  error: 'diag_error',
  unknown: 'diag_unknown',
  text: 'connection_protocol_warning',
  closed: 'diag_closed',
};

/** Explains a connection that opened but never produced a timer state, with what arrived instead. */
function DiagnosticNotice({ diagnostic }: { diagnostic: ConnectionDiagnostic }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200" role="status">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0 space-y-2">
        <p>{t(DIAGNOSTIC_TEXT[diagnostic.reason])}</p>
        {diagnostic.detail && (
          <code className="block max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[11px] text-white/80">
            {diagnostic.detail}
          </code>
        )}
      </div>
    </div>
  );
}

function ConnectionSection() {
  const { settings, updateSettings } = useSettings();
  const { status, diagnostic, unauthorized, server } = useLiveSplit();
  const { t } = useI18n();
  const initial = parseWsUrl(settings.wsUrl);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [token, setToken] = useState(settings.token);
  const [result, setResult] = useState<FormResult>('idle');
  const [testDiagnostic, setTestDiagnostic] = useState<ConnectionDiagnostic | null>(null);
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
    const outcome = await testConnection(url, token);
    updateSettings({ wsUrl: url, token: token.trim() });
    const saved = parseWsUrl(url);
    setHost(saved.host);
    setPort(saved.port);
    setResult(outcome.result);
    setTestDiagnostic(outcome.diagnostic);
  };
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setResult('idle');
  };

  const statusKey: TranslationKey =
    status === 'connected' ? 'connection_status' : status === 'disconnected' ? 'connection_disconnected' : 'connection_connecting';

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-accent">{t('connection_title')}</h3>
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5" role="status">
          <span
            className={cn(
              'relative h-2 w-2 rounded-full transition-all',
              status === 'connected'
                ? diagnostic
                  ? 'bg-[#ffa500]'
                  : 'bg-ahead shadow-[0_0_0_2px_rgba(64,255,64,0.3)]'
                : status === 'disconnected'
                  ? 'bg-behind shadow-[0_0_0_4px_rgba(255,64,64,0.3)]'
                  : 'animate-pulse bg-[#ffa500] shadow-[0_0_0_4px_rgba(255,165,0,0.3)]',
            )}
          />
          <span className="text-xs text-[var(--text-dim)]">
            {status === 'connecting' ? `${t('connection_connecting_to')} ${parseWsUrl(settings.wsUrl).host}` : t(statusKey)}
          </span>
        </div>
      </div>

      <form onSubmit={submit} className="grid grid-cols-[1fr_90px_auto] items-end gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-[var(--text-dim)]">{t('connection_ip')}</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={host}
            onChange={(e) => edit(setHost)(e.target.value)}
            className="h-[38px] w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-[var(--text-dim)]">{t('connection_port')}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={port}
            onChange={(e) => edit(setPort)(e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="h-[38px] w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </label>
        <button
          type="submit"
          disabled={result === 'testing'}
          className={cn(
            'h-[38px] whitespace-nowrap rounded-md border px-5 text-[13px] font-semibold shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-all',
            result === 'ok'
              ? 'border-ahead/40 bg-ahead/15 text-ahead'
              : result === 'failed' || result === 'unauthorized' || result === 'invalid' || result === 'wrong-server'
                ? 'border-behind/40 bg-behind/15 text-behind'
                : 'border-accent/30 bg-accent/15 text-accent hover:-translate-y-0.5 hover:border-accent hover:bg-accent/25 hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)]',
            result === 'testing' && 'cursor-wait opacity-70',
          )}
        >
          {result === 'testing'
            ? t('connection_testing')
            : result === 'ok'
              ? t('connection_test_success_button')
              : result === 'idle'
                ? t('connection_test')
                : t('connection_test_failed_button')}
        </button>
        <label className="col-span-3 space-y-1.5">
          <span className="text-xs font-medium text-[var(--text-dim)]">{t('connection_token')}</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            placeholder={t('connection_token_placeholder')}
            onChange={(e) => edit(setToken)(e.target.value)}
            className="h-[38px] w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white placeholder:font-sans placeholder:text-white/30 transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </label>
      </form>

      {result === 'ok' && <p className="text-xs text-ahead">{t('connection_test_success')}</p>}
      {result === 'failed' && <p className="text-xs text-behind">{t('connection_test_failed')}</p>}
      {result === 'invalid' && <p className="text-xs text-behind">{t('connection_invalid')}</p>}
      {result === 'unauthorized' && <p className="text-xs text-behind">{t('connection_unauthorized')}</p>}

      {server && (
        <p className="text-[11px] text-[var(--text-dim)]">
          {[
            server.liveSplitVersion && `LiveSplit ${server.liveSplitVersion}`,
            server.componentVersion && `WebSocket Server ${server.componentVersion}`,
            `${t('connection_protocol')} ${server.protocolVersion}`,
            server.readOnly && t('connection_read_only'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {server?.protocolVersion === 1 && (
        <p className="flex gap-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
          {t('connection_legacy')}
        </p>
      )}
      {unauthorized && result !== 'unauthorized' && (
        <p className="flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('connection_unauthorized')}
        </p>
      )}

      {result === 'wrong-server' && testDiagnostic ? (
        <DiagnosticNotice diagnostic={testDiagnostic} />
      ) : (
        diagnostic && <DiagnosticNotice diagnostic={diagnostic} />
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
        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 transition-all hover:border-accent hover:bg-white/10"
      >
        <span className="text-base">{current.flag}</span>
        <span className="text-xs font-semibold uppercase text-white">{current.code}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--text-dim)]" aria-hidden>
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('language_label')}
          className="absolute left-0 top-full z-[60] mt-2 min-w-[240px] rounded-lg border border-white/10 bg-[var(--bg-main)] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] [animation:fade-in_0.2s_ease]"
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
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-white/5',
                  settings.language === lang.code && 'bg-accent/15',
                )}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm text-white">{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TOGGLE_MESSAGES: Partial<Record<BooleanSetting, [on: TranslationKey, off: TranslationKey]>> = {
  showHeader: ['notification_header_enabled', 'notification_header_disabled'],
  showTimer: ['notification_timer_enabled', 'notification_timer_disabled'],
  showPredictions: ['notification_predictions_enabled', 'notification_predictions_disabled'],
  showControls: ['notification_controls_enabled', 'notification_controls_disabled'],
  showGraph: ['notification_graph_enabled', 'notification_graph_disabled'],
  showTable: ['notification_table_enabled', 'notification_table_disabled'],
};

/** How see-through the background is in transparent mode; the panel steps aside once you let go. */
function TransparencySlider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const commit = (event: React.SyntheticEvent<HTMLInputElement>) => onCommit(Number(event.currentTarget.value));
  return (
    <div className="rounded-lg bg-white/[0.03] p-3">
      <div className="mb-1 flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-white">
          {t('transparency_title')}
        </label>
        <span className="font-mono text-sm text-accent">{value}%</span>
      </div>
      <p className="mb-3 text-xs text-[var(--text-dim)]">{t('transparency_desc')}</p>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-full cursor-pointer [accent-color:var(--theme-accent)]"
      />
    </div>
  );
}

/** Shown while disconnected: what to check, as before. */
function ConnectionProblem() {
  const { status, unauthorized } = useLiveSplit();
  const { t } = useI18n();
  if (status !== 'disconnected' || unauthorized) return null;
  return (
    <div
      role="alert"
      className="relative mt-6 overflow-hidden rounded-lg border-2 border-[#ff6666] bg-behind p-4 pl-5 shadow-[0_0_20px_rgba(255,64,64,0.5)] [animation:fade-in_0.3s_ease]"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-white" aria-hidden />
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
        <AlertTriangle size={16} className="shrink-0" />
        {t('error_notification_title')}
      </p>
      <div className="text-xs leading-normal text-white/90">
        {t('error_notification_text')}
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {(['error_notification_1', 'error_notification_2', 'error_notification_3', 'error_notification_4'] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Resets every setting; asks first whether to keep the LiveSplit address. */
function ResetSection({ onReset }: { onReset: (keepConnection: boolean) => void }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const choice =
    'flex-1 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5';
  return (
    <section className={SECTION}>
      <div className="flex flex-col gap-3 rounded-lg border border-behind/15 bg-behind/5 p-3">
        <div className="flex items-start gap-4">
          <AlertTriangle size={24} className="shrink-0 text-behind" />
          <p className="text-xs leading-normal text-[var(--text-dim)]">
            {asking ? t('reset_ip_port_message') : t('reset_warning_text')}
          </p>
        </div>
        {asking ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onReset(true)}
              className={cn(choice, 'border-behind/40 bg-behind/10 text-behind hover:bg-behind/20')}
            >
              {t('reset_keep_current')}
            </button>
            <button
              type="button"
              onClick={() => onReset(false)}
              className={cn(choice, 'border-behind/40 bg-behind/10 text-behind hover:bg-behind/20')}
            >
              {t('reset_restore_default')}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className={cn(choice, 'border-white/10 bg-white/5 text-white hover:bg-white/10')}
            >
              {t('reset_cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="w-full rounded-lg border border-behind/30 bg-behind/10 px-4 py-3 text-sm font-semibold text-behind shadow-[0_4px_12px_rgba(255,64,64,0.2)] transition-all hover:-translate-y-0.5 hover:border-behind hover:bg-behind/20 hover:shadow-[0_6px_20px_rgba(255,64,64,0.3)]"
          >
            {t('reset_button')}
          </button>
        )}
      </div>
    </section>
  );
}

/** "Made with 🧠 by Movisterium, with AI support", with the name highlighted. */
function Credits() {
  const { t } = useI18n();
  const [before, after = ''] = t('made_with').split('{0}');
  return (
    <p className="text-xs text-[var(--text-dim)]">
      {before}
      <strong className="text-accent">Movisterium</strong>
      {after}
    </p>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, overriddenKeys, updateSettings, resetSettings } = useSettings();
  const { t } = useI18n();
  const { exportCSV, exportImage, canExport } = useExport();
  const [exporting, setExporting] = useState<'image' | 'csv' | null>(null);
  // Bumped on "reset settings" so the connection form reloads the address.
  const [formGeneration, setFormGeneration] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // After a change you can see on the overlay, the panel steps aside for a
  // moment with a message, then comes back.
  const [peek, setPeek] = useState<string | null>(null);
  const peekRef = useRef<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape first brings the panel back, then closes it.
      if (peekRef.current) {
        clearTimeout(peekTimer.current);
        setPeek(null);
      } else {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  // While aside the panel is inert, which drops focus; give it back to the control that had it.
  const focusBeforePeek = useRef<HTMLElement | null>(null);
  useEffect(() => {
    peekRef.current = peek;
    if (!peek && focusBeforePeek.current) {
      if (focusBeforePeek.current.isConnected) focusBeforePeek.current.focus();
      focusBeforePeek.current = null;
    }
  }, [peek]);
  const endPeek = () => {
    clearTimeout(peekTimer.current);
    setPeek(null);
  };
  const showPeek = (message: string, delay = 0) => {
    endPeek();
    const start = () => {
      // Taken before the panel turns inert and drops the focus.
      focusBeforePeek.current ??= document.activeElement as HTMLElement | null;
      setPeek(message);
      peekTimer.current = setTimeout(() => setPeek(null), PEEK_MS);
    };
    if (delay > 0) peekTimer.current = setTimeout(start, delay);
    else start();
  };

  const selectTheme = (themeId: string) => {
    updateSettings({ theme: themeId });
    showPeek(`${t('theme_applying')} ${t(`theme_${themeId}` as TranslationKey)}...`, THEME_PREVIEW_DELAY_MS);
  };

  const toggle = (key: BooleanSetting) => {
    const enabled = !settings[key];
    updateSettings({ [key]: enabled } as Partial<Settings>);
    const messages = TOGGLE_MESSAGES[key];
    if (messages) showPeek(t(messages[enabled ? 0 : 1]));
  };

  const toggleTransparent = () => {
    const enabled = !settings.chromaKey.enabled;
    updateSettings({ chromaKey: { enabled } });
    showPeek(t(enabled ? 'notification_chroma_key_enabled' : 'notification_chroma_key_disabled'));
  };

  const saveImage = async () => {
    setExporting('image');
    const ok = await exportImage();
    setExporting(null);
    showPeek(t(ok ? 'notification_capture_success' : 'export_failed'));
  };

  const saveCsv = () => {
    setExporting('csv');
    const ok = exportCSV();
    setExporting(null);
    showPeek(t(ok ? 'notification_csv_success' : 'export_failed'));
  };

  const reset = (keepConnection: boolean) => {
    // The address in use, which may come from the page URL rather than the saved settings.
    resetSettings(keepConnection ? { keep: { wsUrl: settings.wsUrl, token: settings.token } } : {});
    setFormGeneration((n) => n + 1);
  };

  const exportButton =
    'flex items-center justify-center gap-2 rounded-lg border bg-white/5 px-4 py-3 text-sm font-medium shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-300 [animation:fade-in_0.3s_ease] max-sm:p-0',
        peek ? 'bg-transparent' : 'bg-black/85',
      )}
      onMouseDown={(event) => {
        // While the panel is aside, a click brings it back instead of reaching the overlay.
        if (peek) endPeek();
        else if (event.target === event.currentTarget) onClose();
      }}
      data-export-ignore
    >
      {peek && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-20 mx-auto w-fit rounded-lg border-2 border-accent bg-accent px-8 py-[18px] text-center text-base font-bold text-[color:var(--accent-fg)] shadow-[0_8px_32px_var(--theme-accent)] [animation:fade-in_0.3s_ease] max-sm:bottom-[60px] max-sm:w-auto"
        >
          {peek}
        </div>
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!!peek}
        className={cn(
          'flex max-h-[90vh] w-full max-w-[500px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[var(--bg-main)] shadow-[0_40px_80px_rgba(0,0,0,0.6)] transition-opacity duration-300 [animation:modal-in_0.3s_ease] max-sm:h-full max-sm:max-h-full max-sm:max-w-full max-sm:rounded-none',
          peek && 'pointer-events-none opacity-0',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-6 py-5">
          <div className="flex items-center gap-4">
            <LanguagePicker />
            <h2 id={titleId} className="text-xl font-semibold text-accent">
              {t('settings_title')}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('settings_close')}
            title={t('settings_close')}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xl leading-none text-[var(--text-dim)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all hover:scale-110 hover:border-behind hover:bg-behind/10 hover:text-behind hover:shadow-[0_4px_15px_rgba(255,64,64,0.3)]"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <ConnectionProblem />
          {overriddenKeys.length > 0 && (
            <p className="mt-6 flex gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-white/80">
              <Link2 size={14} className="mt-0.5 shrink-0 text-accent" />
              {t('url_overrides_notice')}
            </p>
          )}
          <ConnectionSection key={formGeneration} />
          <LiveSplitSection />

          <section className={SECTION}>
            <h3 className="text-base font-semibold text-accent">{t('theme_title')}</h3>
            <ThemeSelector value={settings.theme} onSelect={selectTheme} />
            <SettingRow
              title={t('theme_transparent')}
              desc={t('theme_transparent_desc')}
              checked={settings.chromaKey.enabled}
              onChange={toggleTransparent}
            />
            {settings.chromaKey.enabled && (
              <TransparencySlider
                value={settings.transparency}
                onChange={(transparency) => updateSettings({ transparency })}
                onCommit={(transparency) => showPeek(`${t('transparency_title')}: ${transparency}%`)}
              />
            )}
          </section>

          <section className={SECTION}>
            <h3 className="text-base font-semibold text-accent">{t('display_title')}</h3>
            <div className="space-y-4">
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

          <ObsUrlSection />

          <section className={SECTION}>
            <h3 className="text-base font-semibold text-accent">{t('export_title')}</h3>
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start gap-4">
                <Upload size={24} className="shrink-0 text-white" />
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-white">{t('export_save')}</h4>
                  <p className="text-xs text-[var(--text-dim)]">{t('export_desc')}</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!canExport || exporting !== null}
                  onClick={saveImage}
                  title={t('tooltip_export_image')}
                  className={cn(exportButton, 'border-[#00a2ff] text-[#00a2ff] hover:bg-[#00a2ff]/15')}
                >
                  <ImageIcon size={18} />
                  {exporting === 'image' ? t('export_capturing') : t('export_image')}
                </button>
                <button
                  type="button"
                  disabled={!canExport || exporting !== null}
                  onClick={saveCsv}
                  title={t('tooltip_export_csv')}
                  className={cn(exportButton, 'border-ahead text-ahead hover:bg-ahead/15')}
                >
                  <FileText size={18} />
                  {exporting === 'csv' ? t('export_generating') : t('export_csv')}
                </button>
              </div>
            </div>
          </section>

          <ResetSection key={`reset-${formGeneration}`} onReset={reset} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-gradient-to-b from-black/20 to-black/30 px-5 py-3.5 max-sm:flex-col max-sm:text-center">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[var(--text-dim)] transition-all hover:border-accent hover:bg-white/[0.08]">
            {t('version_label')} {APP_VERSION}
          </span>
          <Credits />
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // Mounting on open gives the connection form fresh values every time.
  return isOpen ? <SettingsDialog onClose={onClose} /> : null;
}
