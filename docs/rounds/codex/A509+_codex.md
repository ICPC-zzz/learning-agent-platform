# A509+ - Real Chinese Agent UX, Memory Routing, and Execution Chain Repair

## Goal

Repair A509 acceptance regressions around explicit long-term memory writes, Chinese-only user-visible Agent output, Codeforces candidate fallback, collapsible execution chains, and user-configured model usage.

## Changes

- Added formal assistant intent resolution with memory write/read priority before Codeforces routing.
- Added synchronous `MEMORY_WRITE` handling in assistant server actions: persist user-explicit long-term memory, deduplicate semantically equivalent memory, and return Chinese confirmation without Codeforces tool calls.
- Applied the Codeforces refresh-report long-term memory to later Codeforces recommendation paths, including both synchronous A508 responses and A509 multi-step aggregation.
- Extended personalized Codeforces candidates with staged fallback:
  - target range + weak tags
  - target range + any tag
  - target range expanded by 100 Rating on both sides
  - nearest target rating in the valid local pool
- Updated A509 result aggregation to prefer the user-configured enabled default CHAT model, guarded by user ownership, SSRF baseUrl validation, and BEARER auth support.
- Added `AbortSignal` support to the LLM provider contract and external chat-completions provider.
- Reworked `/ai` task timeline presentation so running tasks show elapsed time, completed tasks collapse by default, and final answers stay visible outside folded evidence/debug details.
- Replaced visible English debug labels and fallback strings in the touched assistant paths with Chinese display names.

## Tests

- Added `tests/a509-plus-real-agent-ux.test.mjs`.
- Updated the A508 source-label expectation to the new Chinese source label.

Validated:

```bash
pnpm exec tsx --test ../../tests/a508-cf-personalized-agent.test.mjs ../../tests/a509-multi-agent-task.test.mjs ../../tests/a509-plus-real-agent-ux.test.mjs
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm run typecheck
```

All passed.

## Not Done

- No Prisma migration or schema change.
- No git staging, commit, or push.
- Non-BEARER user model auth modes remain blocked by resolver until a dedicated adapter is implemented.
