# A509 Multi-Agent Stability Closure

Date: 2026-06-27

## Scope

This round upgrades the `/ai` Codeforces training-and-contest request from a single synchronous response into a persisted multi-Agent task loop:

- Persist task, per-Agent runs, audit events, and evidence without changing Prisma schema or migrations.
- Support idempotent `requestId`, refresh recovery, user isolation, cancellation, task timeout, Agent timeout, per-Agent retry, and whole-task retry.
- Keep the A508 request shape: recommend today's practice problems based on the learner's real level and provide the nearest upcoming Codeforces contest.
- Show an Agent/tool timeline and final evidence on `/ai`.
- Hide ordinary user UI for internal context budget, token estimates, compression cache, short-term working memory, and internal session summaries.

No Prisma schema or migration was added. No git add/commit/push was run.

## Implemented

- Added file-backed task persistence:
  - `MultiAgentTask`
  - `AgentRun`
  - `AuditEvent`
  - `Evidence`
- Added task repository guarantees:
  - per-user storage files under `.codex_tmp/a509-agent-tasks`
  - per-user async write lock
  - atomic write through temp file + rename
  - `userId + conversationId + requestId` duplicate request reuse
  - conversation task listing scoped by user
  - orphaned queued/running task recovery on conversation load
- Added runtime orchestration for five Agents:
  - `Orchestrator`
  - `LearnerProfile`
  - `CandidateRecommendation`
  - `UpcomingContest`
  - `ResultAggregator`
- Added cancellation and timeout handling:
  - task-level cancellation through `AbortController`
  - task-level timeout finalization
  - Agent-level timeout finalization
  - tool execution abort propagation
  - cancelled tasks do not append a final answer
- Added retry paths:
  - retry a failed/timed-out/cancelled/skipped Agent
  - retry the whole task using the original request
  - per-Agent retry preserves previous Agent run evidence and audit trail
  - per-Agent retry is exposed only after the task reaches a terminal status, avoiding races with the original aggregation pass
- Added dev-only stability injection:
  - enabled only with `LAP_AGENT_STABILITY_TEST_MODE=1` outside production
  - `fail_upcoming_once`
  - `timeout_candidate_once`
  - `delay_task_for_cancel`
- Added `/ai` UI support:
  - task polling
  - task status and Agent timeline
  - tool timeline per Agent
  - final answer area
  - evidence references below final answer
  - audit event details
  - cancel, per-Agent retry, and whole-task retry controls
  - dev-only stability mode selector
- Removed ordinary-user exposure of internal context/compression/short-term memory UI from the `/ai` chat and memory overview.

## Safety Notes

- Task records are scoped by authenticated `userId`; cross-user read/list attempts return not found or an empty list.
- Client input cannot choose a user identity.
- The A509 task loop still uses only the read-only tools from A508.
- The official Codeforces contest request remains guarded by the existing Codeforces API boundary.
- Evidence is normalized into safe source labels, timestamps, and URLs; raw upstream payloads are not displayed.
- Community Skill execution remains disabled-by-default and is not part of this task loop.
- Production builds ignore the dev stability injection mode.

## Verification

Passed:

```powershell
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
node --test tests/a504-tools-runtime.test.mjs tests/a504-plus-memory-contracts.test.mjs tests/a505-context-compression.test.mjs tests/a505-conversation-repository.test.mjs tests/a507-conversation-lifecycle.test.mjs tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs
node --test tests/a509-multi-agent-task.test.mjs
```

Additional source check:

```powershell
rg -n "工作记忆|会话摘要|系统学习上下文|上下文预算|压缩缓存|估算 Token|窗口上限|压缩次数|查看当前有效摘要|上下文状态" apps/web/src/app/ai apps/web/src/app/_components/AssistantChatPanel.tsx -S
```

Result: no matches after UI cleanup.

Browser render smoke:

- `http://localhost:3000/ai` rendered in the in-app browser as dev user Alpha.
- Visible DOM included `AI 助手`, `当前页面`, `长期记忆概览`, and `只结合当前页面信息和可管理记忆进行回答`.
- Visible DOM did not include internal context/token/prompt/compression/working-memory/session-summary terms.
- The in-app browser runtime did not reliably trigger React textarea state for full task submission, so full click-through task creation should still be repeated by the user in a normal authenticated browser session.

## Remaining Limits

- The repository is intentionally file-backed for A509 because Prisma schema changes were prohibited.
- Candidate recommendation still requires configured database content and a synced Codeforces account to produce full personalized results.
- The real LLM provider path remains guarded/mock-only according to the current project safety boundary.
- Browser verification for full task creation should be repeated in the user's authenticated session after this round, especially against local DB data.
