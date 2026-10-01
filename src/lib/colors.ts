import type { SplitStatus } from './run';

/** Ahead / behind / neutral, the same in every theme (see `ahead`, `behind`, `neutral` in tailwind.config.ts). */
export const AHEAD_HEX = '#40ff40';
export const BEHIND_HEX = '#ff4040';
export const NEUTRAL_HEX = '#aaaaaa';

/** LiveSplit-style split colours: gold, ahead gaining/losing, behind gaining/losing. */
export const STATUS_TEXT_CLASS: Record<SplitStatus, string> = {
  gold: 'text-amber-300',
  'ahead-gaining': 'text-ahead',
  'ahead-losing': 'text-[#9cff9c]',
  'behind-gaining': 'text-[#ff9c9c]',
  'behind-losing': 'text-behind',
  neutral: 'text-neutral',
};

export const STATUS_HEX: Record<SplitStatus, string> = {
  gold: '#fcd34d',
  'ahead-gaining': AHEAD_HEX,
  'ahead-losing': '#9cff9c',
  'behind-gaining': '#ff9c9c',
  'behind-losing': BEHIND_HEX,
  neutral: NEUTRAL_HEX,
};

export const deltaTextClass = (delta: number | null | undefined) =>
  delta === null || delta === undefined ? 'text-[var(--text-dim)]' : delta <= 0 ? 'text-ahead' : 'text-behind';
