import type { SplitStatus } from './run';

/** LiveSplit-style split colours: gold, ahead gaining/losing, behind gaining/losing. */
export const STATUS_TEXT_CLASS: Record<SplitStatus, string> = {
  gold: 'text-amber-300',
  'ahead-gaining': 'text-green-500',
  'ahead-losing': 'text-green-300',
  'behind-gaining': 'text-red-300',
  'behind-losing': 'text-red-500',
  neutral: 'text-gray-400',
};

export const STATUS_HEX: Record<SplitStatus, string> = {
  gold: '#fcd34d',
  'ahead-gaining': '#22c55e',
  'ahead-losing': '#86efac',
  'behind-gaining': '#fca5a5',
  'behind-losing': '#ef4444',
  neutral: '#9ca3af',
};

export const deltaTextClass = (delta: number | null | undefined) =>
  delta === null || delta === undefined ? 'text-[var(--text-dim)]' : delta <= 0 ? 'text-green-500' : 'text-red-500';
