<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LiveSplit Timer

Web overlay for LiveSplit (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v3). Everything runs in the browser; pages are statically prerendered. User docs are in Portuguese under `docs/`.

## Commands

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: run all four before committing.
- `npm run mock:server -- --scale 0.05`: fake LiveSplit server on `ws://localhost:15721` (`--game-time`, `--src`, `--port`).
- `npm run dev`: dev server on port 3000.
- GitHub Pages build: `STATIC_EXPORT=1 PAGES_BASE_PATH=/LiveSplit-Timer npm run build` (static export into `out/`, deployed by `.github/workflows/pages.yml` on pushes to `main`). Keep every route statically exportable: no server-only features, dynamic segments need `generateStaticParams` with `dynamicParams = false`, and build app URLs with `NEXT_PUBLIC_BASE_PATH`.

## Code map

- `src/lib/`: pure logic, covered by Vitest in `src/lib/__tests__/`. `run.ts` (LiveSplit's delta, prediction, colour and subsplit rules), `state.ts` (server message validation), `speedrun.ts`, `settings.ts` (defaults, URL parameters), `time.ts`.
- `src/contexts/`: `SettingsContext` (saved settings plus non-persisted URL overrides), `LiveSplitContext` (WebSocket lifecycle, state, world record), `RunControlsContext` (button and hotkey rules).
- `src/components/Overlay.tsx`: renders `/` and the single-section pages from `src/app/[view]/page.tsx`.

## Rules

- The server is the **LiveSplit.WebSocketServer** component (alexmtos/LiveSplit.WebSocketServer, spec in its `docs/PROTOCOL.md`), not LiveSplit's built-in server. The app connects with `?protocol=2` (plus `&token=`) and must keep working with component 1.x, which ignores the query and speaks protocol 1. Protocol 2 events carry no icons; they are fetched with `state { includeIcons: true }` and merged by `withCachedIcons`. Parse every message through `parseServerMessage` in `src/lib/state.ts`.
- Send commands with `sendCommand(action, args)` from `LiveSplitContext`; it uses JSON with ids in protocol 2 and plain text in protocol 1. Features that need protocol 2 (`setcomparison`, `settimingmethod`, errors, read-only info) must check `server.protocolVersion`.
- `npm run mock:server` mirrors the component (`--legacy` for 1.x, `--token`, `--read-only`, `--broken` for a greeting that fails); extend it when the app starts using a new action.
- Times are integer milliseconds per timing method (`{ realTime, gameTime }`). Read them through `pickTime`/`comparisonTime` in `src/lib/run.ts` with the context's `timingMethod` and `comparison`. Never hard-code `realTime` or `"Personal Best"`.
- When changing run math, match LiveSplit's C# (`LiveSplitStateHelper`, `DeltaComponent`, `RunPrediction`) and add a test.
- Every user-facing string goes in `src/lib/translations.ts` for all five languages. `typecheck` fails when a key is missing.
- Tailwind v3 cannot apply opacity to `var()` colours. Use the `accent` colour (`bg-accent/15`), not `bg-[var(--theme-accent)]/15`.
- Control buttons call `preventDefault` on `mousedown` so a later Space press splits instead of re-clicking the focused button. Keep this for new buttons.
- User documentation follows Anthropic docs style: sentence-case headings, second person, task-oriented steps, tables for reference, `> **Nota:**` callouts, no emoji. Update `docs/` when behaviour or options change.
