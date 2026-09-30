/**
 * Time formatting that mirrors LiveSplit's defaults:
 * - times are truncated (never rounded up), so the display never shows a time
 *   that has not been reached yet;
 * - the minutes/hours/days parts only appear once they are non-zero;
 * - deltas always carry a sign and use tenths of a second.
 */

export interface TimeParts {
  sign: '' | '-';
  /** Everything before the decimal separator, e.g. "1:02:03" or "45". */
  main: string;
  /** Hundredths of a second, always two digits. */
  fraction: string;
}

interface Units {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
}

function toUnits(ms: number): Units {
  const total = Math.floor(Math.abs(ms));
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
    ms: total % 1000,
  };
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

function mainPart({ days, hours, minutes, seconds }: Units): string {
  if (days > 0) return `${days}d ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  if (minutes > 0) return `${minutes}:${pad2(seconds)}`;
  return `${seconds}`;
}

export function formatTimeParts(ms: number): TimeParts {
  const units = toUnits(ms);
  return {
    // Truncation can turn e.g. -0.004 into "0.00"; don't show "-0.00".
    sign: ms < 0 && Math.floor(Math.abs(ms) / 10) > 0 ? '-' : '',
    main: mainPart(units),
    fraction: pad2(Math.floor(units.ms / 10)),
  };
}

/** "1:23.45" style time, or "-" when there is no time. */
export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '-';
  const { sign, main, fraction } = formatTimeParts(ms);
  return `${sign}${main}.${fraction}`;
}

/** "+5.2", "-1:05.3", "+1:02:03" style delta, or "-" when there is no delta. */
export function formatDelta(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '-';
  const units = toUnits(ms);
  const sign = ms < 0 ? '-' : '+';
  const main = mainPart(units);
  // Over an hour the tenths are noise; LiveSplit drops them too.
  if (units.days > 0 || units.hours > 0) return `${sign}${main}`;
  return `${sign}${main}.${Math.floor(units.ms / 100)}`;
}
