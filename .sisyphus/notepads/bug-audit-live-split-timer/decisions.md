Wave 2 architectural decisions (initial draft)
- TimeUtils canonical: introduce a canonical parse/format function that unifies time extraction across code paths; avoid duplicative logic in multiple modules.
- Shadowed logReader: implement a simple mutex/flag guard around initialization to ensure only one reader is created; subsequent calls reuse the instance.
- WR load serialization: introduce a small serial queue around WorldRecordLoader.load() invocations to prevent concurrent loads.
- EnvGuard: central guard for environment access; on missing required env vars, throw a structured error with actionable messages; avoid cascading failures.
- CONFIG immutability: define a top-level CONFIG object as immutable; expose read-only accessors for consumers; avoid in-place mutations.
- Test infra scaffold: add basic skeleton tests per module area to ensure future changes are verified; share common test helpers.

Rationale: these decisions emphasize stability, determinism, and easier future maintenance by centralizing guards and canonicalizing time handling.
