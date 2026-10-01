import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRefreshRate, subscribeTicker } from '@/lib/ticker';

describe('shared ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setRefreshRate(20);
  });
  afterEach(() => vi.useRealTimers());

  it('calls fast listeners every tick and slow ones about every interval, from one timer', () => {
    const fast = vi.fn();
    const slow = vi.fn();
    const stopFast = subscribeTicker(0, fast);
    const stopSlow = subscribeTicker(100, slow);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(fast).toHaveBeenCalledTimes(20);
    expect(slow).toHaveBeenCalledTimes(10);
    stopFast();
    stopSlow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows the refresh rate', () => {
    const listener = vi.fn();
    const stop = subscribeTicker(0, listener);
    setRefreshRate(10);
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(10);
    stop();
  });
});
