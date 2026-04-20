# Draft: Bug Audit for LiveSplit Timer - Function hotspots & test infra

## Requirements (confirmed)
- Audit project functions to identify bugs with a focus on critical hotspots (shadowed variables, duplicate utilities, race conditions).
- Assess test infrastructure gaps and propose a minimal scaffold if absent.
- Prioritize fixes that reduce runtime errors, improve determinism, and improve observability.

## Technical Decisions (taken for drafting)
- Prioritize critical hotspots: shadowed logReader variable, duplicate TimeUtils.parseLiveSplitTime, race conditions in WorldRecordLoader and WR display.
- Introduce environment guards for browser-only APIs (localStorage, fetch) to support SSR/no-browser environments.
- Enforce immutability in CONFIG usage; route mutations through a controlled API if needed.
- If no test infra exists, propose scaffolding (src/, tests/, npm scripts) to enable QA validation.
- Add lightweight observability for hotspots via a centralized logger with toggle.

## Research Findings (from exploration + Metis)
- Hotspots identified: initializeLogReader shadow variable; TimeUtils has duplicate parseLiveSplitTime; potential race in WorldRecordLoader.load and WR display updates; environment guards around localStorage/fetch are weak; mutable shared state risks.
- Test infra: repo lacks a src/ directory and visible test configuration in the current scope; plan includes scaffolding guidance.

## Open Questions
- Do we want a framework-agnostic approach or prescribe Jest as the test framework?
- Should we lock in a canonical TimeUtils module interface now or align later with repo conventions?

## Scope Boundaries
- IN: Code hotspots in root app.js and related modules; general test infra guidance.
- EXCLUDE: Other non-hotspot areas unless they impact hotspots or tests.

## Next Steps (aligned with the plan)
- Produce a formal plan (.sisyphus/plans/bug-audit-live-split-timer.md) with concrete tasks, acceptance criteria, QA scenarios, and agent profiles.
- Create a formal plan draft to guide execution and then finalize with a Metis/Oracle review if required.

Submitted as a draft to capture the interview conclusions and set the stage for the formal plan generation.
