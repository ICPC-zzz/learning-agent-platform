# A507 Conversation Memory Lifecycle

Date: 2026-06-27

## Scope

This round implemented the assistant multi-conversation lifecycle closure for `/ai`.

The implementation stays inside the existing dev file conversation repository and DB memory repository metadata. It does not add a second conversation repository, does not change Prisma schema, and does not enable real tool or agent execution.

## Implemented

- Real persisted active conversation list in the `/ai` chat surface.
- Explicit New Chat server action that creates a new persisted conversation id.
- Conversation switching that reloads messages, compression state, retained context, and summary status.
- Conversation archive, restore, rename repository method, and delete repository method.
- Conversation management tab with current and archived conversation lists.
- Delete confirmation before user-visible conversation deletion.
- Memory metadata lifecycle fields:
  - `sourceConversationId`
  - `sourceMessageId`
  - `lifecycleStatus`
  - `createdAt` / `updatedAt` from the DB record
- Archive maps source long-term memories from `active` to `historical`.
- Restore maps source long-term memories from `historical` to `active`.
- Delete removes the conversation and its source memories through repository methods.
- Memory manager now exposes only long-term memories:
  - current long-term memory
  - historical long-term memory
- Historical memories are restored only by restoring their source conversation.
- Prompt retrieval only uses active long-term memory.

## Long-Term Memory Behavior

Conversation-generated long-term memory is currently conservative and deterministic:

- It is created only when the user explicitly asks the assistant to remember something, such as `记住 ...` or `remember ...`.
- It is stored as `RETRIEVABLE`.
- It carries `metadata.memoryKind = conversation_long_term`.
- It carries `metadata.sourceConversationId`.
- It starts with `metadata.lifecycleStatus = active`.

Global manually-created memories without a `sourceConversationId` are not changed by conversation archive or restore.

## CCX Reuse Record

- COPY: none.
- ADAPT: lifecycle model inspired by CCX's session / summary / long-term memory separation.
- REWRITE: current project implementation uses structured repository metadata and server actions instead of CCX file memory directories or CLI runtime code.
- SKIP: CCX shell/tool execution, background agent loops, direct memory file writes, and unrelated UI/runtime framework code.

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

Browser verified on `http://localhost:3000/ai`:

- `/ai` loads with HTTP 200.
- Chat tab renders the real conversation sidebar.
- New creates a persisted conversation visible in the sidebar.
- Conversation management tab renders current and archived groups.
- Memory management tab is present.

## Remaining Limits

- Conversation persistence is still dev JSON file storage, not production DB conversation tables.
- No Prisma schema migration was executed.
- No real LLM provider or real tools were enabled.
- Browser verification covered rendering and New Chat persistence; the user should still manually verify the full archive / restore / delete flow in their own session.
