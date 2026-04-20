Wave 2 blockers and issues (to be resolved during implementation)
- Unclear repository structure for TimeUtils canonical function: need exact module location and export naming to wire into existing calls.
- Shadowed logReader: current initialization order is not well-guarded under concurrency; need a minimal guard to serialize initialization path.
- WR load guard: ensure WorldRecordLoader load path is serialized to avoid duplicate work and race conditions.
- EnvGuard design: determine how to best raise errors or gate operations when env is missing; ensure consistent error reporting.
- CONFIG immutability: decide on strategy (freeze objects, use deep-freeze utilities, or functional getters) with minimal performance impact.
- Test infra scaffold: set up a baseline test harness and a couple of smoke tests for each Wave 2 area; need to confirm test framework (jest, vitest, mocha).

Open questions: confirm the repository conventions for module paths, test framework, and logging format to ensure tests are aligned with project standards.
