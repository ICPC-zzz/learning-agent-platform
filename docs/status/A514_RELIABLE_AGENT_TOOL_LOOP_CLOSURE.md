# A514 Reliable Agent Tool Loop Closure

Date: 2026-06-28

## Status

A514 is blocked at Phase A in the current local environment. Phase B was not started.

Reason: the required real PostgreSQL/Prisma gate could not be executed because `DATABASE_URL`, `LAP_ALLOW_REAL_DB_INTEGRATION`, `LAP_ACKNOWLEDGE_TEST_DB_ONLY`, and the A514/Prisma integration switch were not enabled in this environment.

## Completed This Round

- Fixed the current `apps/web` typecheck blocker in `apps/web/src/lib/assistant/memory-service.ts` by explicitly narrowing parsed memory consolidation candidates to `unknown[]`.
- Added `tests/a514-prisma-memory-integration.test.mjs`, a guarded real Prisma integration gate for:
  - mapped owner user plus legacy preview-owner alias reads,
  - explicit long-term memory write through the service layer,
  - service-level delete through owner aliases,
  - tombstone persistence through a new repository instance,
  - background consolidation dedupe against deleted tombstones,
  - active-memory supersede into a replacement memory.
- The new test defaults to skip and only runs against a local/test database after explicit environment gates are enabled.

## Phase A Verification State

Current run:

```bash
node --test tests/a514-prisma-memory-integration.test.mjs
```

Result: skipped by design. This is not a real Prisma pass.

To run the real gate in a later session, use a local or test-only PostgreSQL database and enable:

```powershell
$env:LAP_ALLOW_REAL_DB_INTEGRATION="true"
$env:LAP_ACKNOWLEDGE_TEST_DB_ONLY="true"
$env:LAP_A514_REAL_PRISMA_MEMORY_TEST="true"
# or: $env:LAP_PRISMA_INTEGRATION_TEST="true"
$env:DATABASE_URL="<local-or-test-postgres-url>"
node --test tests/a514-prisma-memory-integration.test.mjs
```

The test rejects production-looking database URLs and only deletes rows created with its own `lap_a514_memory_*` prefix.

## A514 Capability Matrix

| Item | State |
| --- | --- |
| A513 Prisma integration supplement | Test added, but not verified against real DB in this environment. |
| Provider-neutral Tool Call | Not implemented. |
| True Provider Tool Call | Not implemented. |
| Stub Provider | Used only inside the Phase A memory gate; not counted as Agent Loop success. |
| Agent Loop | Not started. |
| Tool Result feedback into model context | Not implemented. |
| Multi-tool model decision | Not implemented. |
| Read-only parallel tool execution | Existing canonical runtime metadata supports read-only/concurrency-safe tools, but A514 model loop did not implement this. |
| Dependent serial tool execution | Not implemented for A514. |
| Loop limit | Not implemented for A514. |
| Repeated-call guard | Not implemented for A514. |
| Partial failure handling | Existing runtime has structured statuses; not wired into A514 Agent Loop. |
| Cancellation | Existing runtime has cancellation handling; not wired into A514 Agent Loop. |
| Timeout | Existing runtime has timeout handling; not wired into A514 Agent Loop. |
| Evidence | Not implemented for A514. |
| Browser verification | Not run for A514 because Phase B was not started. |
| User re-verification | Not applicable yet. |
| Deterministic path compatibility | Existing deterministic assistant paths were not modified. |
| Not implemented | All Phase B model-driven loop behavior. |
| Not verified | Real Prisma Phase A gate, because no local/test DB was available. |

## Stop Condition Applied

The A514 request required Phase A to pass before any provider-neutral Agent Tool Loop work. Because the real DB gate did not run, Phase B implementation was intentionally skipped.
