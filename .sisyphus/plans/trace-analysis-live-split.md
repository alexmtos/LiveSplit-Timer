# Trace Analysis - LiveSplit Timer Performance Optimizations (Trace-20260419)

## TL;DR
- Establish a robust baseline from Trace-20260419T211036.json.gz, identify main-thread hotspots (render loop and inbound WebSocket handling), and craft a plan to reduce CPU usage with safe, auditable changes. The plan focuses on render batching, offloading heavy work to workers, and memory profiling.
- Deliver a measurable reduction in long tasks, smoother frame times, and a stable memory footprint without altering UX.

## Context
### Original Request
- Analyze the provided performance trace for CPU hotspots and propose concrete, executable optimizations.
### Interview Summary
- Hotspots are centered on the main thread in the render loop (app.js) and in the WebSocket inbound path (ws_adapter.js). A secondary concern is timer cadence and potential GC pressure.
### Metis Review (gaps addressed)
- Gaps identified: explicit backpressure on inbound messages, per-tick budget for main thread work, and clear acceptance criteria for each optimization.

## Work Objectives
### Core Objective
- Reduce main-thread CPU time and long tasks while preserving timer accuracy and UI fidelity.
### Deliverables
- A documented, executable plan with task-level acceptance criteria and QA scenarios.
### Definition of Done
- All tasks completed with documented evidence; verification shows target metrics met or exceeded; no user-visible regressions.
### Must Have
- Baseline long-task profiling, render-batching strategy, WS inbound offloading plan, memory profiling, and a clear verification plan.
### Must NOT Have
- No destructive changes to core UX or feature set; no global code rewrites without incremental validation.

## Verification Strategy
- Agent-executed verification consisting of: baseline capture, post-change measurements, and regression checks.
- Evidence artifacts to collect: .sisyphus/evidence/task-<N>-trace.pdf/.png, per-task logs, and memory snapshots.

## Execution Strategy
### Parallel Execution Waves
- Wave 1: Baseline profiling and instrumentation (A1)
- Wave 2: Render batching improvements (A2)
- Wave 3: WS inbound offload (A3) and background CPU work relocation (A4)
- Wave 4: Memoization and memory profiling (A5, A6) if needed

### Dependency Matrix
- No hard dependencies beyond baseline data; all tasks are designed to be incremental.

### Agent Dispatch Summary
- Wave 1 tasks: main-thread profiling, WS inbound analysis
- Wave 2 tasks: render batching design and pilot implementation
- Wave 3 tasks: worker-based offloads, IPC contracts
-
## TODOs
- [ ] A1. Baseline profiling and instrumentation
  - What to do: Establish long-task profiling, per-frame time budgets, and inbound WS workload metrics using PerformanceObserver and a lightweight instrumentation layer in app.js and ws_adapter.js.
  - Must Not Do: Introduce production-level logging overhead; only toggle-able instrumentation.
  - Recommended Agent Profile: Category unspecified-high; Skills: perf-profiling, browser-Workers, ast-grep for pattern analysis.
  - Parallelization: YES | Wave 1
  - References: MDN PerformanceObserver, PerformanceLongTaskTiming; Chrome DevTools Performance guide.
  - Acceptance Criteria: Baseline metrics captured for idle and burst scenarios; documented in the plan.
  - QA Scenarios: Happy path: baseline run; Edge: burst WS messages.

- [ ] A2. Render cadence hardening and batching
  - What to do: Batch UI updates to requestAnimationFrame; minimize layout thrashing; rely on transforms for visuals.
  - Must Not Do: Defer critical timer visuals beyond one frame without user notice.
  - Recommended Agent Profile: Category visual-engineering; Skills: frontend-ui-ux, perf-profiling.
  - Parallelization: YES | Wave 2
  - References: MDN requestAnimationFrame; web.dev efficient animations.
  - Acceptance Criteria: Frame-time metrics improved; rendering stays within 60fps budget under baseline loads.
  - QA Scenarios: Replicate idle and moderate-load updates; verify jank absence.

- [ ] A3. Inbound WebSocket offload and coalescing
  - What to do: Move heavy onmessage processing to a Worker; implement message batching across frames.
  - Must Not Do: Break message ordering or state consistency.
  - Recommended Agent Profile: Category deep; Skills: web-workers, IPC-contractions.
  - Parallelization: YES | Wave 3
  - References: MDN Web Workers API; Chromium IPC guidance.
  - Acceptance Criteria: Main thread WS handling CPU time reduced; correct UI state after worker results.
  - QA Scenarios: Burst WS messages; verify no re-ordering; UI reflects batched updates.

- [ ] A4. Move heavy computations to background workers
  - What to do: Identify CPU-heavy computations in the UI thread and relocate to workers; ensure proper data transfer.
  - Must Not Do: Overcomplicate data contracts; maintain stability.
  - Recommended Agent Profile: Category deep; Skills: worker_threads (Electron), performance profiling.
  - Parallelization: YES | Wave 3-4
  - References: Web Workers API; Electron worker_threads docs.
  - Acceptance Criteria: Main-thread time reductions; no correctness regressions.
  - QA Scenarios: Validate with simulated large input data; compare results.

- [ ] A5. Memoization and lazy evaluation
  - What to do: Cache deterministic computations; invalidate caches on dependency changes.
  - Must Not Do: Grow caches without bounds; memory grows unchecked.
  - Recommended Agent Profile: Category quick; Skills: code-review (memoization patterns), perf-profiling.
  - Parallelization: YES | Wave 4
  - References: Common memoization patterns; profiling docs.
  - Acceptance Criteria: Reduced CPU time for repeated calculations; correct invalidation.
  - QA Scenarios: Re-run with repeated calls; ensure same results with less time.

- [ ] A6. Memory profiling and leak checks
  - What to do: Take heap snapshots during long-running runs; investigate leaks tied to UI state or listeners.
  - Acceptance Criteria: Heap growth stabilized; no detached DOM trees after typical flows.
  - QA Scenarios: Run long playback; collect memory timeline.

- [ ] A7. Verification plan and instrumentation
  - What to do: Document verification steps; create lightweight instrumentation for future perf checks.
  - Acceptance Criteria: A formal plan with success criteria and artifact locations.

- [ ] A8. Perf scenarios and coverage
  - What to do: Add 3 perf scenarios (idle, burst WS, mixed) with defined pass/fail and data collection steps.
  - Acceptance Criteria: All scenarios produce expected results within thresholds.

## Final Verification Wave
- After all tasks: run an independent verification wave (oracle + performance QA) to confirm improvements and guard regressions.

## Plan Artifacts and Evidence
- Plan saved to: .sisyphus/plans/trace-analysis-live-split.md
- Evidence: .sisyphus/evidence/task-TRACE-PLAN-01.*
