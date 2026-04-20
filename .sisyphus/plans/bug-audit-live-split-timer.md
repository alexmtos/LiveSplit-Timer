# Bug Audit Plan: LiveSplit Timer UI (app.js + timer.html)

## TL;DR
> Goal: Deliver a decision-complete audit plan for bug surfaces in the LiveSplit Timer UI (app.js + timer.html), focusing on logReader lifecycle, dynamic imports, and global state patterns (CONFIG/TRANSLATIONS). Deliverables include explicit guardrails, test scaffolding, and an atomic commit strategy.
> Deliverables: A complete audit with conservative scope, test plan scaffolding, and concrete next steps for fixes.
> Effort: Large
> Parallel: YES - 4 initial audit tasks in Wave 1
> Critical Path: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

## Context
### Original Request
- Evaluate project functions for bugs with focus on entry points, lifecycle, and state management in the LiveSplit Timer UI.
### Interview Summary (Phase 1 findings)
- Notable hotspots: logReader lifecycle shadowing in initializeLogReader; asynchronous dynamic import; global-ish CONFIG and TRANSLATIONS; browser vs Node branching; WebSocket integration to LiveSplit.
- Risks: race conditions on dynamic import readiness; shadowing leads to inconsistent logReader; testability challenges due to global state.
- Metis review suggested modularization of config/i18n and explicit readiness contracts.

## Work Objectives
### Core Objective
- Provide a complete, executable audit plan addressing: logReader lifecycle, dynamic import gating, modular config/i18n, WS lifecycle, and test scaffold.
### Deliverables
- Draft audit report with file references and evidence, acceptance criteria, and QA scenarios.
- TDD-oriented test plan with scaffolding.
- Atomic commit strategy and PR rollout guidance.
### Definition of Done
- All findings are traceable to code references; tests and QA scenarios are concrete; plan is executable without further scope decisions.
### Must Have
- Clear scope boundaries, guardrails from Metis, and concrete acceptance criteria with commands.
### Must NOT Have
- No scope creep beyond app.js, timer.html, and their immediate dependencies unless explicitly approved.

## Verification Strategy
- Verification: Agent-executed tests and scripted checks using rg/Playwright where possible.
- Evidence: Stilulated artifacts in .sisyphus/evidence/ and plan references.

## Execution Strategy
### Wave 1
- Task 1: Audit logReader shadowing and readiness
- Task 2: Audit dynamic import timing and readiness gating
- Task 3: Modularize CONFIG and TRANSLATIONS for testability
- Task 4: Harden WS_URL handling and WebSocket lifecycle

### Wave 2
- Task 5: Develop a TDD-oriented test plan and scaffolding
- Task 6: Atomic commit strategy and rollout plan

### Dependency Matrix
- Task 5 depends on 1–4; Task 6 depends on 5.

## TODOs (Agent-scope)
- [ ] Task 1: Audit logReader shadowing and readiness
- [ ] Task 2: Audit dynamic import timing and readiness gating
- [ ] Task 3: Modularize CONFIG and TRANSLATIONS for testability
- [ ] Task 4: Harden WS_URL handling and WebSocket lifecycle
- [ ] Task 5: Develop a TDD-oriented test plan and scaffolding
- [ ] Task 6: Atomic commit strategy and rollout plan

## Evidence References
- app.js: Core UI logic, logReader lifecycle, and WS integration
- timer.html: UI entry point loading app.js
- styles.css: UI styling
- .sisyphus/plans/bug-audit-live-split-timer.md: This plan itself

## Acceptance Criteria (QA-oriented)
- AC1: Shadowing and readiness issues identified with file/line references and reproduction steps.
- AC2: Readiness gating strategies proposed with test plan (Playwright/Jest) and sample mocks.
- AC3: Modular config and i18n plan with sample interfaces.
- AC4: WS lifecycle documented with test scaffolds for connect/reconnect flows.
- AC5: A complete, executable test plan (Task 5) with scaffolds and mocks.
- AC6: Atomic commit strategy documented with example workflow.

## Next Steps
- Confirm scope (Tasks 1–6) and acceptance baselines.
- Execute Wave 1 tasks and feed results back to refine Task 5 and Task 6.

---
Generated in the planning session for a fully defined, executable bug-audit plan.
