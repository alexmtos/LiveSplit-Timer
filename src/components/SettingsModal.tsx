'use client';

import React, { useState } from 'react';
import { Trash2, X, Image as ImageIcon, FileText } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useI18n } from '@/hooks/useI18n';
import { THEME_COLORS } from '@/lib/themes';
import { useLiveSplit } from '@/contexts/LiveSplitContext';
import { cn } from '@/lib/utils';
import { useExport } from '@/hooks/useExport';
import { Settings } from '@/types';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { t } = useI18n();
  const { isConnected, isConnecting } = useLiveSplit();
  const { exportCSV, exportImage } = useExport();
  const [activeLangDropdown, setActiveLangDropdown] = useState(false);

  if (!isOpen) return null;

  const languages = [
    { code: 'pt-BR' as const, flag: '🇧🇷', name: 'Português (Brasil)' },
    { code: 'en-US' as const, flag: '🇺🇸', name: 'English (US)' },
  ];

  type ToggleOption = {
    key: keyof Settings;
    title: string;
    desc: string;
  };

  const toggleOptions: ToggleOption[] = [
    { key: 'showControls', title: 'display_controls', desc: 'display_controls_desc' },
    { key: 'showGraph', title: 'display_graph', desc: 'display_graph_desc' },
    { key: 'showTable', title: 'display_table', desc: 'display_table_desc' },
    { key: 'alwaysExpandedSplits', title: 'display_expanded', desc: 'display_expanded_desc' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-300">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-[var(--bg-main)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-4">
             <div className="relative">
               <button
                 onClick={() => setActiveLangDropdown(!activeLangDropdown)}
                 className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition-all"
               >
                 <span className="text-lg">{languages.find(l => l.code === settings.language)?.flag || '🇧🇷'}</span>
                 <span className="text-xs font-bold text-white uppercase">{settings.language}</span>
               </button>
               {activeLangDropdown && (
                 <div className="absolute left-0 top-full mt-2 w-56 rounded-lg border border-white/10 bg-[var(--bg-main)] p-2 shadow-xl z-[60]">
                   {languages.map((l) => (
                     <button
                       key={l.code}
                       onClick={() => {
                         updateSettings({ language: l.code });
                         setActiveLangDropdown(false);
                       }}
                       className={cn(
                         "flex w-full items-center gap-3 rounded-md p-2 hover:bg-white/5 transition-colors",
                         settings.language === l.code && "bg-[var(--theme-accent)]/15"
                       )}
                     >
                       <span>{l.flag}</span>
                       <span className="text-sm text-white">{l.name}</span>
                     </button>
                   ))}
                 </div>
               )}
             </div>
             <h2 className="text-xl font-bold text-[var(--theme-accent)]">{t('settings_title')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:border-red-500 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {/* Connection */}
           <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--theme-accent)] uppercase tracking-wider">{t('connection_title')}</h3>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5">
                   <div className={cn(
                     "h-2 w-2 rounded-full transition-all",
                     isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                     isConnecting ? "bg-amber-500 animate-pulse" : "bg-red-500"
                   )} />
                   <span className="text-xs text-[var(--text-dim)]">
                     {t(isConnected ? 'connection_status' : isConnecting ? 'connection_connecting' : 'connection_disconnected')}
                   </span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_90px_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{t('connection_ip')}</label>
                  <input
                    type="text"
                    value={settings.wsUrl.replace('ws://', '').split(':')[0]}
                    onChange={(e) => {
                       const port = settings.wsUrl.split(':')[2] || '15721';
                       updateSettings({ wsUrl: `ws://${e.target.value}:${port}` });
                    }}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-[var(--theme-accent)] focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider">{t('connection_port')}</label>
                  <input
                    type="text"
                    value={settings.wsUrl.split(':')[2] || '15721'}
                    onChange={(e) => {
                      const host = settings.wsUrl.replace('ws://', '').split(':')[0];
                      updateSettings({ wsUrl: `ws://${host}:${e.target.value}` });
                    }}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-[var(--theme-accent)] focus:outline-none transition-all"
                  />
                </div>
                <button className="h-[38px] rounded-md bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 px-4 text-xs font-bold text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/25 transition-all">
                  {t('connection_test')}
                </button>
              </div>
           </section>

           {/* Themes */}
           <section className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--theme-accent)] uppercase tracking-wider">{t('theme_title')}</h3>
              <div className="grid grid-cols-3 gap-3">
                 {Object.keys(THEME_COLORS).map(themeId => (
                   <button
                     key={themeId}
                     onClick={() => updateSettings({ theme: themeId })}
                     className={cn(
                       "group relative flex h-14 flex-col items-center justify-center overflow-hidden rounded-lg border-2 transition-all",
                       settings.theme === themeId ? "border-[var(--theme-accent)]" : "border-white/10 hover:border-white/30"
                     )}
                     style={{
                       background: `linear-gradient(135deg, ${THEME_COLORS[themeId].bg} 0%, ${THEME_COLORS[themeId].bg} 50%, ${THEME_COLORS[themeId].accent} 50%, ${THEME_COLORS[themeId].accent} 100%)`
                     }}
                   >
                     <span className="relative z-10 text-[10px] font-bold text-white uppercase drop-shadow-md">{t(`theme_${themeId}`)}</span>
                   </button>
                 ))}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/3 p-4 border border-white/5">
                <div>
                  <h4 className="text-sm font-semibold text-white">{t('theme_transparent')}</h4>
                  <p className="text-[11px] text-[var(--text-dim)]">{t('theme_transparent_desc')}</p>
                </div>
                <button
                  onClick={() => updateSettings({ chromaKey: { enabled: !settings.chromaKey.enabled } })}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    settings.chromaKey.enabled ? "bg-[var(--theme-accent)]" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-md",
                    settings.chromaKey.enabled ? "left-6" : "left-1"
                  )} />
                </button>
              </div>
           </section>

           {/* Display */}
           <section className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--theme-accent)] uppercase tracking-wider">{t('display_title')}</h3>
              <div className="space-y-3">
                {toggleOptions.map((opt) => (
                  <div key={opt.key} className="flex items-center justify-between rounded-lg bg-white/3 p-3 border border-white/5">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{t(opt.title)}</h4>
                      <p className="text-[11px] text-[var(--text-dim)]">{t(opt.desc)}</p>
                    </div>
                    <button
                      onClick={() => {
                        const val = settings[opt.key];
                        if (typeof val === 'boolean') {
                          updateSettings({ [opt.key]: !val });
                        }
                      }}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        settings[opt.key] ? "bg-[var(--theme-accent)]" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 h-4 w-4 rounded-full bg-white transition-all",
                        settings[opt.key] ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>
                ))}
              </div>
           </section>

           {/* Export */}
           <section className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--theme-accent)] uppercase tracking-wider">{t('export_title')}</h3>
              <div className="rounded-lg bg-white/3 p-4 border border-white/5 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-white/5">
                    <FileText size={24} className="text-[var(--theme-accent)]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{t('export_save')}</h4>
                    <p className="text-[11px] text-[var(--text-dim)]">{t('export_desc')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <button
                     onClick={exportImage}
                     className="flex items-center justify-center gap-2 rounded-md border border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/10 px-4 py-2.5 text-xs font-bold text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/20 transition-all"
                   >
                      <ImageIcon size={16} />
                      {t('export_image')}
                   </button>
                   <button
                     onClick={exportCSV}
                     className="flex items-center justify-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-xs font-bold text-green-500 hover:bg-green-500/20 transition-all"
                   >
                      <FileText size={16} />
                      {t('export_csv')}
                   </button>
                </div>
              </div>
           </section>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-black/20 p-5 flex items-center justify-between">
           <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest">{t('version_label')} 2.0.0</span>
           </div>
           <button
             onClick={() => {
                if(confirm(t('reset_warning'))) resetSettings();
             }}
             className="flex items-center gap-2 text-xs font-bold text-red-500/70 hover:text-red-500 transition-colors"
           >
              <Trash2 size={14} />
              {t('reset_button')}
           </button>
        </div>
      </div>
    </div>
  );
}
