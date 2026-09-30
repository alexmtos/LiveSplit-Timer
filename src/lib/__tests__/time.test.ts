import { describe, expect, it } from 'vitest';
import { formatDelta, formatTime, formatTimeParts } from '@/lib/time';

describe('formatTime', () => {
  it('formats like LiveSplit, truncating hundredths', () => {
    expect(formatTime(0)).toBe('0.00');
    expect(formatTime(5_239)).toBe('5.23');
    expect(formatTime(65_009)).toBe('1:05.00');
    expect(formatTime(3_723_450)).toBe('1:02:03.45');
    expect(formatTime(90_061_000)).toBe('1d 01:01:01.00');
  });

  it('keeps the sign of negative times (starting offsets)', () => {
    expect(formatTime(-4_567)).toBe('-4.56');
    expect(formatTimeParts(-4_567)).toEqual({ sign: '-', main: '4', fraction: '56' });
    expect(formatTime(-3)).toBe('0.00');
  });

  it('returns a dash when there is no time', () => {
    expect(formatTime(null)).toBe('-');
    expect(formatTime(undefined)).toBe('-');
    expect(formatTime(Number.NaN)).toBe('-');
  });
});

describe('formatDelta', () => {
  it('always shows the sign', () => {
    expect(formatDelta(5_260)).toBe('+5.2');
    expect(formatDelta(-5_260)).toBe('-5.2');
    expect(formatDelta(0)).toBe('+0.0');
  });

  it('shows minutes and drops tenths past one hour', () => {
    expect(formatDelta(-65_300)).toBe('-1:05.3');
    expect(formatDelta(3_723_450)).toBe('+1:02:03');
  });

  it('returns a dash when there is no delta', () => {
    expect(formatDelta(null)).toBe('-');
  });
});
