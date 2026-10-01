/**
 * Shared clock for everything that moves while the timer runs. One
 * `setInterval` drives every listener, so all displays change in the same
 * frame: each update costs the browser a full style/layout/paint/composite
 * pass, so CPU use grows with the number of updates per second (the
 * `refreshRate` setting). A `requestAnimationFrame` loop is avoided on purpose:
 * it keeps the page rendering at 60 fps even when nothing on screen changes.
 */
type Listener = (now: number) => void;

interface Subscription {
  listener: Listener;
  /** At most once per this many milliseconds; 0 for every tick. */
  intervalMs: number;
}

export const REFRESH_RATES = [10, 20, 30, 60] as const;
export type RefreshRate = (typeof REFRESH_RATES)[number];
export const DEFAULT_REFRESH_RATE: RefreshRate = 20;

/** The big timer: every tick. */
export const TIMER_INTERVAL_MS = 0;
/** The live point of the graph and the live deltas and predictions (shown to the tenth of a second). */
export const SLOW_INTERVAL_MS = 100;

const subscriptions = new Set<Subscription>();
let tickMs = 1000 / DEFAULT_REFRESH_RATE;
let interval: ReturnType<typeof setInterval> | null = null;
let tick = 0;

function run() {
  tick += 1;
  const now = performance.now();
  for (const subscription of subscriptions) {
    const every = Math.max(1, Math.round(subscription.intervalMs / tickMs));
    if (tick % every === 0) subscription.listener(now);
  }
}

function restart() {
  if (interval !== null) clearInterval(interval);
  interval = subscriptions.size > 0 ? setInterval(run, tickMs) : null;
}

/** Sets how many times per second the clock ticks. */
export function setRefreshRate(rate: number) {
  const next = 1000 / rate;
  if (next === tickMs) return;
  tickMs = next;
  restart();
}

/** Calls `listener` on the shared clock (every tick, or about every `intervalMs`) until the returned function is called. */
export function subscribeTicker(intervalMs: number, listener: Listener): () => void {
  const subscription = { listener, intervalMs };
  subscriptions.add(subscription);
  if (interval === null) restart();
  return () => {
    subscriptions.delete(subscription);
    if (subscriptions.size === 0) restart();
  };
}
