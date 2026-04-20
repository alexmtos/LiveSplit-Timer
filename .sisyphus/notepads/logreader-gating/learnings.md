Title: LogReader Readiness Gating - Learnings

- What I did: Implemented a readiness-gating Proxy around the existing window.logReader API to prevent race conditions when UI code calls logReader before _logReaderInstance is fully initialized. The gating uses a Proxy to defer function calls until readiness, preserving the public API and not altering call sites.
- Why: The original dynamic import path for log-reader.js does not exist in this repo; however, race windows can still occur if UI code touches logReader during startup. The gating ensures deterministic startup without requiring changes to all call sites.
- How gating works (high level):
  1) Immediately after calling _initializeLogReaderSingleton(), we attach a Proxy around window.logReader that defers any function calls until _logReaderInstance is non-null. 
  2) If a call is made before readiness, the wrapper returns a Promise that resolves after readiness, effectively queuing the call until the log Reader is ready.
  3) Once ready, calls proceed synchronously as before.
- Gating strategies (proposed):
  - Ready Promise (implemented implicitly via the Proxy): UI can await logReader methods but isn’t forced to structure code around readiness. This keeps existing code paths intact.
  - Event-based readiness (alternative): Emit a custom 'logReaderReady' event when the internal _logReaderInstance is initialized; UI can listen for this event and then perform actions.
- Testing plan (two gating strategies):
  1) Simulate a call to logReader.getStats() immediately after startup and verify it resolves only after readiness (or returns a sensible fallback if ready instantly).
  2) Simulate a call to logReader.connect() from a delayed UI action and verify it resolves immediately once the internal reader is ready; ensure no uncaught exceptions.
- Edge cases to consider: (a) Multiple rapid calls before readiness; (b) LogReader failure to initialize; (c) UI component mounting before app finishes startup; (d) Callbacks or promises returned by gating must be chainable without leaks.
- Verification plan (commands you can run):
  - [ ] Run app and trigger UI actions that rely on logReader; ensure no race in first 1-2 seconds after startup.
  - [ ] Use Playwright to simulate a user action that engages logReader after a artificial delay; confirm gating does not deadlock.
- Next steps: If any race windows remain, consider adding a small init hook in app bootstrap to explicitly mark readiness and optionally emit an event for strict gating.
