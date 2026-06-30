# A505 - /ai Conversation Context Compression Closure

Date: 2026-06-27

## Scope

This round implemented the `/ai` conversation context compression closure v1.

The goal was a runnable local loop, not a production AI backend.

## User Clarification

The user clarified that `E:\code\ccx` is a school/workshop inherited project and can be freely used by this project even though it has no `LICENSE`, `NOTICE`, or root `package.json`.

This changes the working assumption for future CCX-related rounds: missing license files in that local project should not by itself block reading or reusing CCX code when the user explicitly asks for it.

A505 did not read or copy CCX code because the requested `/ai` compression closure could be completed inside the current codebase.

## Implemented

- Added deterministic local context compression utilities in `packages/ai-core/src/memory/a505-context-compression.ts`.
- Added dev-only server-side assistant conversation persistence in `apps/web/src/lib/assistant/assistant-conversation-repository.ts`.
- Wired `/ai` server actions to server-owned conversation state.
- Removed client-side authoritative message storage from the assistant local store.
- Added manual compression from the `/ai` context panel.
- Added explicit command compression for prompts such as “请压缩当前上下文”.
- Added automatic compression when the estimated context budget crosses the compression threshold.
- Added visible context status, compression count, archived message count, and structured summary display.
- Preserved archived messages in the dev JSON file instead of deleting them.
- Kept long-term memory writes disabled unless explicitly authorized by existing memory boundaries.

## Compression Behavior

The local compressor:

- Estimates tokens with a deterministic heuristic.
- Redacts obvious sensitive values.
- Extracts structured categories such as goals, facts, constraints, decisions, todos, and avoid-list items.
- Keeps the latest 2 messages active by default.
- Archives older messages under a compression id.
- Stores a compact summary in active context.
- Stores the full structured summary in the compression record for UI display.

## Verification

Passed:

- `pnpm --filter @learning-agent-platform/ai-core typecheck`
- `pnpm --filter @learning-agent-platform/web typecheck`
- `node --test tests/a504-tools-runtime.test.mjs`
- `node --test tests/a504-plus-memory-contracts.test.mjs`
- `node --test tests/a505-*.test.mjs`

Root typecheck:

- Initially failed before TypeScript execution because Windows bash could not resolve `/dev/stderr` for `tee`.
- Fixed in the follow-up typecheck repair by removing the `/dev/stderr` dependency, selecting a working Python interpreter, and falling back to copying dependencies when symlink creation is unavailable.
- `pnpm run typecheck` now passes.

Browser verified on `http://localhost:3000`:

- Dev login with `dev-user-001`.
- `/ai` page loads.
- Manual compression button works.
- Refresh restores compressed context state.
- Conversation can continue after compression.
- Explicit compression command works and emits a system event.
- Automatic budget compression triggers with `LAP_AI_CONTEXT_WINDOW_TOKENS=900`.

## Not Implemented

- No real LLM summary.
- No real provider call.
- No real Agent loop.
- No real tool execution.
- No Prisma schema or migration.
- No production conversation persistence.
- No Git add, commit, or push.

## Files

Added:

- `packages/ai-core/src/memory/a505-context-compression.ts`
- `apps/web/src/lib/assistant/assistant-conversation-repository.ts`
- `tests/a505-context-compression.test.mjs`
- `tests/a505-conversation-repository.test.mjs`
- `docs/status/A505_CONTEXT_COMPRESSION_CLOSURE.md`
- `docs/rounds/codex/A505_codex.md`

Updated:

- `packages/ai-core/src/memory/index.ts`
- `apps/web/src/lib/assistant/assistant-types.ts`
- `apps/web/src/lib/assistant/assistant-server-actions.ts`
- `apps/web/src/lib/assistant/memory-service.ts`
- `apps/web/src/app/_components/AssistantConversationStore.tsx`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`
- `docs/codex-context/CURRENT_HANDOFF.md`

## Remaining Risk

- Token counts are estimates, not model tokenizer counts.
- Compression quality is deterministic preview quality, not LLM quality.
- Dev JSON persistence is not production-safe storage.
- The UI is a local preview of context compression, not a fully online Agent system.

## Next Recommendation

Pick one small follow-up:

- Define a repository interface so A505 dev JSON persistence can later be replaced by Prisma.
- Add a real tokenizer adapter behind the existing budget API.
- Polish the `/ai` context status panel and empty states.
