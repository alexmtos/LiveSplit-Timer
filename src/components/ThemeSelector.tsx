'use client';

import React, { useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { THEME_IDS, getTheme, type CustomThemeColors } from '@/lib/themes';
import type { TranslationKey } from '@/lib/translations';
import { cn } from '@/lib/utils';

const diagonal = (bg: string, accent: string) =>
  `linear-gradient(135deg, ${bg} 0%, ${bg} 50%, ${accent} 50%, ${accent} 100%)`;

/**
 * The current theme with previous/next buttons (cyclic); clicking the bar
 * expands a grid with every theme.
 */
export function ThemeSelector({
  value,
  custom,
  onSelect,
}: {
  value: string;
  /** Colours of the custom theme, to preview it. */
  custom: CustomThemeColors;
  onSelect: (themeId: string) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const gridId = useId();
  const current = THEME_IDS.includes(value) ? value : 'default';
  const index = THEME_IDS.indexOf(current);
  const colors = getTheme(current, custom);
  const name = (id: string) => t(`theme_${id}` as TranslationKey);
  const step = (delta: number) => onSelect(THEME_IDS[(index + delta + THEME_IDS.length) % THEME_IDS.length]);

  return (
    <div className="flex flex-col">
      <div
        // The gradient stops at the padding box so the border is one solid accent colour.
        className="relative flex h-20 items-center justify-between overflow-hidden rounded-lg border-2 bg-clip-padding"
        style={{ backgroundImage: diagonal(colors.bg, colors.accent), borderColor: colors.accent }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={gridId}
          title={t('theme_show_all')}
          onClick={() => setExpanded((open) => !open)}
          className="absolute inset-0 flex items-center px-6 text-left transition-colors hover:bg-white/5"
        >
          <span className="text-lg font-bold [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]" style={{ color: colors.accent }}>
            {name(current)}
          </span>
        </button>
        <div className="relative ml-auto flex gap-1.5 pr-1.5">
          {[
            { delta: -1, label: t('theme_prev'), Icon: ChevronLeft },
            { delta: 1, label: t('theme_next'), Icon: ChevronRight },
          ].map(({ delta, label, Icon }) => (
            <button
              key={delta}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => step(delta)}
              className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-white/30 bg-white/15 text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all hover:scale-105 hover:border-accent hover:bg-white/25 hover:text-accent active:scale-95"
            >
              <Icon size={22} className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]" />
            </button>
          ))}
        </div>
      </div>

      <div
        id={gridId}
        className={cn(
          'grid grid-cols-3 gap-3 overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          expanded ? 'max-h-[500px] pb-2 pt-4 opacity-100' : 'invisible max-h-0 opacity-0',
        )}
      >
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={current === id}
            onClick={() => onSelect(id)}
            className={cn(
              'flex h-[60px] items-center justify-center rounded-lg border-2 bg-clip-padding transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
              current === id
                ? 'border-accent shadow-[0_0_15px_rgba(var(--theme-accent-rgb),0.3)]'
                : 'border-[#2a2a2a] hover:border-[#555]',
            )}
            style={{ backgroundImage: diagonal(getTheme(id, custom).bg, getTheme(id, custom).accent) }}
          >
            <span className="text-sm font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]">{name(id)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
