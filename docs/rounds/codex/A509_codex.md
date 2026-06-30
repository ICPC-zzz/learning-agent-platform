# A509 - Multi-Agent Task Stability, Audit, and Recovery Loop

Date: 2026-06-27

## Scope

Implemented a persistent, cancellable, retryable, recoverable multi-Agent task loop for the `/ai` A508 Codeforces request:

> 根据我的真实水平推荐今天练习的题，再告诉我最近一场可以参加的 Codeforces 比赛。

This round did not add Prisma schema, migrations, write-capable tools, real LLM execution, or Git operations.

## Implemented

- Added `assistant-task-repository.ts` for persisted task records, Agent runs, audit events, evidence, idempotency, user isolation, cancellation flags, and recovery.
- Added `assistant-multi-agent-runtime.ts` for:
  - `Orchestrator`
  - `LearnerProfile`
  - `CandidateRecommendation`
  - `UpcomingContest`
  - `ResultAggregator`
- Added server actions for:
  - creating/reusing A509 tasks from the A508 combined request
  - listing conversation tasks
  - cancelling a task
  - retrying one Agent
  - retrying the whole task
  - exposing dev-only stability test mode availability
- Added abort propagation through assistant tool execution and Codeforces provider calls.
- Added `/ai` task UI:
  - Agent/tool timeline
  - evidence below final answer
  - audit event details
  - cancel/retry controls
  - polling and refresh recovery
  - dev-only failure/timeout/cancel injection selector
- Added client-side `requestId` generation so duplicate submissions can be reused server-side.
- Limited per-Agent retry to terminal task states so retry aggregation cannot race the original task aggregation.
- Updated conversation load/compression responses to include persisted tasks.
- Removed ordinary-user visibility for internal context budget, token estimates, compression cache, short-term working memory, and internal session summaries.
- Added A509 stability tests.

## Verification

Passed:

```powershell
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm run typecheck
node --test tests/a509-multi-agent-task.test.mjs
node --test tests/a504-tools-runtime.test.mjs tests/a504-plus-memory-contracts.test.mjs tests/a505-context-compression.test.mjs tests/a505-conversation-repository.test.mjs tests/a507-conversation-lifecycle.test.mjs tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs
```

UI cleanup source check passed with no matches:

```powershell
rg -n "工作记忆|会话摘要|系统学习上下文|上下文预算|压缩缓存|估算 Token|窗口上限|压缩次数|查看当前有效摘要|上下文状态" apps/web/src/app/ai apps/web/src/app/_components/AssistantChatPanel.tsx -S
```

Browser render smoke:

- Opened `http://localhost:3000/ai` in the in-app browser.
- Verified the page rendered for dev user Alpha.
- Verified visible DOM had no internal context/token/prompt/compression/working-memory/session-summary terms.
- Full task submission was not completed in the in-app browser because the runtime did not reliably trigger React textarea state; A509 task lifecycle behavior is covered by Node tests and should be manually rechecked in a normal authenticated browser session.

## Files

Added:

- `apps/web/src/lib/assistant/assistant-task-repository.ts`
- `apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts`
- `tests/a509-multi-agent-task.test.mjs`
- `docs/status/A509_MULTI_AGENT_STABILITY_CLOSURE.md`
- `docs/rounds/codex/A509_codex.md`

Updated:

- `apps/web/src/lib/assistant/assistant-types.ts`
- `apps/web/src/lib/assistant/assistant-server-actions.ts`
- `apps/web/src/lib/assistant/tools/tool-types.ts`
- `apps/web/src/lib/assistant/tools/tool-executor.ts`
- `apps/web/src/lib/assistant/tools/codeforces-tools.ts`
- `apps/web/src/lib/assistant/providers/codeforces-personalized-provider.ts`
- `apps/web/src/lib/cf-contest-service.ts`
- `apps/web/src/app/_components/AssistantConversationStore.tsx`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`
- `apps/web/src/app/ai/AiAssistantTabs.tsx`
- `apps/web/src/app/ai/AssistantMemoryOverviewPanel.tsx`
- `apps/web/src/app/ai/AssistantWorkspaceClient.tsx`
- `docs/codex-context/CURRENT_HANDOFF.md`

## Not Implemented

- No Prisma task tables or migrations.
- No production distributed worker or cross-process queue.
- No write-capable tool execution.
- No community Skill execution.
- No Git add, commit, or push.

## Project Progress

33.00%
