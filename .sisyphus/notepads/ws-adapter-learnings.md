WS Adapter Learnings
- Implemented a deterministic WebSocket adapter to normalize lifecycle events (connect, open, message, close, error) and reconnection strategy.
- Prefer browser/global WebSocket; fall back to Node's ws if available; avoid introducing new runtime dependencies.
- Deterministic backoff delays [1000, 2000, 4000] ms and maxRetries support predictable tests and behavior.
- Added tests scaffolding and a small mock to exercise open/error paths without a live WS server.
- Next: wire adapter into app.js so existing WS usage routes through the adapter; ensure correct lifecycle alongside the app's connection manager.
