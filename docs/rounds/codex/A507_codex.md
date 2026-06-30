# A507 - Conversation List and Long-Term Memory Lifecycle

Date: 2026-06-27

## Scope

This round implemented the `/ai` multi-conversation lifecycle and linked source long-term memory lifecycle.

It did not enable real LLM providers, real tools, free agent execution, Prisma migrations, or Git operations.

## Implemented

### 真实会话列表

- Extended the existing file assistant conversation repository with:
  - explicit create
  - list active / archived
  - rename
  - archive
  - restore
  - delete
- Added lifecycle fields to conversation sessions while keeping old A505 records compatible as `active`.
- Added a real conversation sidebar to `/ai`.
- `New` / `New chat` now creates a persisted server conversation instead of only resetting client state.
- Clicking an old conversation restores its messages and compression state.

### 归档

- Active conversations can be archived from the sidebar.
- Archived conversations leave the active list.
- Archived conversations are visible in the new conversation management tab.
- Archived conversations reject new messages until restored.

### 恢复

- Archived conversations can be restored from the conversation management tab.
- Restore moves the conversation back to the active list.
- Restore updates linked source long-term memories back to `active`.

### 删除

- Conversation delete has a browser confirmation prompt.
- Delete removes the conversation from persisted dev JSON storage.
- Delete calls the DB memory repository to delete memories linked by `sessionId`, `metadata.sourceConversationId`, or legacy `metadata.conversationId`.
- Delete does not affect other conversations.

### 长期记忆联动

- Added DB memory repository methods:
  - `updateConversationMemoryLifecycle`
  - `deleteConversationMemories`
- Added memory metadata view fields:
  - `sourceConversationId`
  - `lifecycleStatus`
- Conversation archive changes linked `RETRIEVABLE` memories to `historical`.
- Conversation restore changes linked `RETRIEVABLE` memories back to `active`.
- Prompt memory retrieval now ignores historical/deleted memories.
- Global manually-created memories without `sourceConversationId` are not changed by conversation archive or restore.

### 记忆管理界面

- Memory manager now exposes only long-term memory.
- Tabs:
  - current long-term memory
  - historical long-term memory
- Historical memory can only be restored by restoring the source conversation.
- Internal short-term memory, working memory, context budget state, compression cache, and internal session summaries are no longer presented as user-managed memory items.

## CCX 直接复用

- None.

## CCX 适配重写

- Adapted the CCX idea of separating working memory, session summaries, and long-term memory.
- Rewritten for this project as repository metadata lifecycle updates and server actions.

## Browser Verification

Verified on existing `http://localhost:3000` service:

- `/ai` returned HTTP 200.
- Browser DOM contains chat tab, conversation management tab, memory management tab, conversation sidebar, and New control.
- Clicking New created a persisted conversation visible in the sidebar.
- Conversation management tab rendered current / archived groups and long-term memory count.

## User Still Needs To Reverify

- Full manual archive / restore / delete flow in the user's real browser session.
- Creating a source long-term memory by asking the assistant to remember a stable fact, then archiving/restoring/deleting the source conversation.
- Refresh persistence after the full manual flow.

## Not Implemented

- No production conversation DB schema.
- No Prisma migration.
- No real LLM call.
- No external tool execution.
- No full-text conversation search.
- No advanced tags, bulk export, or batch operations.
- No A511 stability task.
- No Rating recommendation changes.
- No new Tool/Skill.
- No Git add, commit, or push.

## Not Verified

- Full browser archive / restore / delete flow was not exercised automatically because delete has destructive local side effects and should be manually confirmed by the user.
- Real DB memory lifecycle behavior depends on a configured database; package typechecks passed, but no Prisma migration or DB reset was run.

## Verification

Passed:

```powershell
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
node --test tests/a504-tools-runtime.test.mjs
node --test tests/a504-plus-memory-contracts.test.mjs
node --test tests/a505-*.test.mjs
node --test tests/a507-*.test.mjs
```

## Files

Added:

- `apps/web/src/app/ai/AssistantConversationManager.tsx`
- `tests/a507-conversation-lifecycle.test.mjs`
- `docs/status/A507_CONVERSATION_MEMORY_LIFECYCLE.md`
- `docs/rounds/codex/A507_codex.md`

Updated:

- `packages/ai-core/src/memory/a505-context-compression.ts`
- `packages/db/src/types.ts`
- `packages/db/src/repositories/memory-repository.ts`
- `apps/web/src/lib/assistant/assistant-types.ts`
- `apps/web/src/lib/assistant/assistant-conversation-repository.ts`
- `apps/web/src/lib/assistant/memory-service.ts`
- `apps/web/src/lib/assistant/assistant-server-actions.ts`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`
- `apps/web/src/app/ai/AiAssistantTabs.tsx`
- `apps/web/src/app/ai/AssistantMemoryManager.tsx`
- `apps/web/src/app/ai/AssistantMemoryOverviewPanel.tsx`
- `docs/codex-context/CURRENT_HANDOFF.md`

## Project Progress

31.00%
