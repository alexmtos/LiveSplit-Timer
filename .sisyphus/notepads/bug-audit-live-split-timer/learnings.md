Wave 2 Learnings (noteworthy patterns and decisions)
- Scope focus: finalize fixes and infra scaffolding (shadowed logReader, TimeUtils canonical, WR load serialization, EnvGuard, CONFIG immutability, test infra scaffold).
- Evidence collection: plan to emit logs and diagnostic artifacts alongside tests to prove regression-free states.
- Assumptions: plan treats Wave 2 as a single cohesive objective with multiple sub-areas; no changes outside Wave 2 footprint are touched.
- Early guard: Immutable CONFIG and central EnvGuard are critical to reduce nondeterminism in runtime hotpaths.
- Risk awareness: race conditions in WR loading and logReader initialization were the major drivers in Wave 1; Wave 2 should introduce serialized access guards and canonicalization to prevent regressions.
- Validation mindset: lsp_diagnostics on touched files, focused tests, and small manual checks for runtime references.

Note: This document is for internal traceability of Wave 2 decisions and evidence collection.
