# A515 R4 + R5 Agent Execution Closure

Date: 2026-06-28

## Scope

A515 closed the A514 DB gate leftover and implemented the first reliable model-driven Agent Loop path for the `/ai` Codeforces training/contest task timeline.

No Prisma schema, migration, `db push`, Git staging, commit, or destructive cleanup was performed.

## A514 DB Gate Fix

- Added root command: `npm run test:db:memory-integration`.
- Updated `tests/a514-prisma-memory-integration.test.mjs` to load Web-compatible env files from `apps/web/.env*` before DB/root fallbacks.
- Reduced the explicit real-DB test gate to `LAP_ALLOW_REAL_DB_TESTS=1`.
- Kept local/test DB URL safety checks and production-like URL blocking.
- Skip messages are now Chinese and do not print `DATABASE_URL` or secrets.
- The test continues to use unique prefixed data and prefix-only cleanup.

## R4 Reliable Agent Loop

Implemented `packages/ai-core/src/agent-runtime/reliable-agent-loop.ts`:

- Provider-neutral tool calling contract on the existing `LlmProvider` path.
- OpenAI-compatible Chat Completions adapter support for:
  - `tools`
  - `tool_choice`
  - `parallel_tool_calls`
  - assistant `tool_calls`
  - tool messages with `tool_call_id`
- Tool-call validation before execution:
  - unique tool call IDs
  - registered/enabled/allowlisted tool
  - read-only risk category
  - no side effects or confirmation
  - blocked identity/permission/credential/URL/file-path arguments
  - duplicate tool + normalized args blocked after the first call
- Canonical execution through `InMemoryToolRuntime`.
- Exactly one structured tool result is appended for every model tool call, including invalid calls.
- Loop limits:
  - max model turns: 4
  - max tool calls: 6
  - max parallel read-only tools: 3
  - loop/model timeout and cancellation propagation
- R4 event types are emitted without raw prompt, raw provider response, raw tool output, stack traces, credentials, or DB internals.

## R5 Persisted Timeline

The `/ai` Codeforces plan path now attempts the reliable Agent Loop first when the configured CHAT provider supports tool calling.

- Reuses `FileAssistantTaskRepository` and the existing multi-agent task UI.
- Persists R4 audit events into task `auditEvents`.
- Writes the final answer into the existing task `finalAnswer`.
- Keeps terminal tasks folded by the existing `<details>` behavior.
- Refresh restores task timeline/final answer from the task repository, not localStorage.
- Unsupported or missing tool-calling provider falls back to the previous deterministic multi-agent compatibility path.
- Existing stability injection modes for tool empty/internal/timeout/cancel/permission-denied are preserved by task storage and accepted by the R4 task path.

## Validation

Passed:

```bash
node --test tests/a515-reliable-agent-loop.test.mjs tests/a515-assistant-task-repository-agent-loop-events.test.mjs
npm run test:db:memory-integration
node --test tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs tests/a509-plus-real-agent-ux.test.mjs tests/a512-agent-tool-adapter.test.mjs tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a513-background-memory-consolidation.test.mjs tests/a513-tool-runtime-browser-injection.test.mjs
npm -w @learning-agent-platform/ai-core run typecheck
npm -w @learning-agent-platform/web run typecheck
npm -w @learning-agent-platform/db run typecheck
npx eslint packages/ai-core/src/agent-runtime/reliable-agent-loop.ts tests/a515-reliable-agent-loop.test.mjs tests/a515-assistant-task-repository-agent-loop-events.test.mjs
npm -w @learning-agent-platform/web run dev -- --port 3105
```

Notes:

- `npm run test:db:memory-integration` skipped safely because `LAP_ALLOW_REAL_DB_TESTS=1` was not set.
- `/ai` dev-server smoke returned HTTP 200 on port `3105`.
- Full package lint still fails due existing repository backlog:
  - `ai-core`: 300 lint errors
  - `web`: 2079 lint errors
  - `db`: 57 lint errors
  These include old `console/process` globals, `var`, unused variables, and generated shim issues. The new A515 loop/tests pass scoped lint.

## Known Limits

- Browser QA did not run real multi-tool model scenarios because the local environment did not provide an enabled real tool-calling CHAT model.
- The R4 Web path opens the existing Codeforces read-only tools and loads long-term memory into model context; it does not add a separate model-callable memory-read tool in this round.
- Provider/tool events are persisted as safe summaries only; this is intentional and should not be relaxed.
