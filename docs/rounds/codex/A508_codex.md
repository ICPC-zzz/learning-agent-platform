# A508 - Real Learning Level CF Training and Upcoming Contest Tool Closure

Date: 2026-06-27

## Scope

Implemented the current Codeforces assistant closure requested for A508:

- Use latest valid learning report estimated real rating instead of official rating when available.
- Add read-only local-pool CF training candidate tool.
- Add read-only official upcoming contest tool.
- Add deterministic CF intent routing.
- Show tool evidence on the current AI page.
- Keep learning report/review/code-analysis summaries as read-only context, not user long-term memory.

## Implemented

- Added `codeforces-personalized-provider.ts`.
- Registered three assistant tools:
  - `resolveLearnerTrainingProfile`
  - `getPersonalizedCodeforcesCandidates`
  - `getUpcomingCodeforcesContests`
- Updated the assistant orchestrator to route CF intents before the LLM provider guard.
- Added tool timeline metadata to assistant responses and latest displayed assistant messages.
- Added chat UI rendering for tool timeline evidence.
- Added read-only learning artifact classification.
- Updated memory service and memory overview UI so learning artifacts do not count as user-managed long-term memory.
- Updated Codeforces contest fetch to accept injected fetch, enforce official API host/path, and support the A508 upcoming contest provider cache.
- Added A508 Node tests.

## Verification

Passed:

```powershell
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
node --test tests/a504-tools-runtime.test.mjs tests/a504-plus-memory-contracts.test.mjs tests/a505-context-compression.test.mjs tests/a505-conversation-repository.test.mjs tests/a507-conversation-lifecycle.test.mjs tests/a508-cf-personalized-agent.test.mjs
node --test tests/a508-cf-personalized-agent.test.mjs
```

Real Codeforces API smoke passed:

- official `contest.list?gym=false`
- source `codeforces_api`
- returned 3 future contests
- no warnings

## Not Implemented

- No Prisma schema migration.
- No historical contest listing tool.
- No write-capable tool execution.
- No community Skill execution.
- No git add, commit, or push.

## Files

Added:

- `apps/web/src/lib/assistant/learning-artifact-classification.ts`
- `apps/web/src/lib/assistant/providers/codeforces-personalized-provider.ts`
- `tests/a508-cf-personalized-agent.test.mjs`
- `docs/status/A508_CF_PERSONALIZED_AGENT_CLOSURE.md`
- `docs/rounds/codex/A508_codex.md`

Updated:

- `apps/web/src/lib/assistant/assistant-orchestrator.ts`
- `apps/web/src/lib/assistant/assistant-server-actions.ts`
- `apps/web/src/lib/assistant/assistant-types.ts`
- `apps/web/src/lib/assistant/memory-service.ts`
- `apps/web/src/lib/assistant/tools/codeforces-tools.ts`
- `apps/web/src/lib/assistant/tools/tool-registry.ts`
- `apps/web/src/lib/assistant/tools/tool-types.ts`
- `apps/web/src/lib/assistant/learning-artifact-memory.ts`
- `apps/web/src/lib/cf-contest-service.ts`
- `apps/web/src/lib/codeforces-client.ts`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`
- `apps/web/src/app/ai/AssistantMemoryOverviewPanel.tsx`
- `docs/codex-context/CURRENT_HANDOFF.md`

## Project Progress

32.00%
