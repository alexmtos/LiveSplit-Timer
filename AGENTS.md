<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- The app talks to the **LiveSplit.WebSocketServer** component (default `ws://localhost:15721`), not LiveSplit's built-in TCP/WebSocket server. The server pushes `{ state }` JSON on every timer event and every 15 s; see `src/types/livesplit.ts` for the payload and the accepted commands.
- Times on the wire are integer milliseconds per timing method (`{ realTime, gameTime }`). Always go through `src/lib/run.ts` helpers so the current timing method and comparison chosen in LiveSplit are respected.
- Keep time/run math in pure modules under `src/lib/` and cover it with Vitest (`npm test`).
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm run mock:server` starts a fake LiveSplit server for local development.
