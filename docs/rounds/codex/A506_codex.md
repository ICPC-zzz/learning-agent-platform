# A506 - AI Assistant User Context, Article Collections, and Memory Management

Date: 2026-06-27

## Scope

This round fixed the user-facing AI assistant and personal-center loop after A505 context compression.

The requested focus was:

- Reuse CCX design/code ideas where useful for Agent context selection and memory handling.
- Make `/user` show article favorites and recent article reading across daily hotspots, GitHub daily, and technical articles.
- Make Codeforces learning analysis and review plan persist in the user experience until regeneration.
- Let the AI assistant answer the current logged-in user about safe user learning data.
- Add new-conversation behavior and expose manageable archived conversation summaries.
- Make `pnpm run typecheck` pass completely.

## CCX Reference Use

Allowed reference project:

- `E:\code\ccx`

Target-read CCX concepts only:

- Relevant memory selection from summaries/manifests instead of loading every memory.
- Paginated or summarized conversation history ideas.
- Context budget and completion-threshold ideas.
- Memory taxonomy ideas.

No CCX project structure was copied into this project.

## Implemented

### Article favorites and recent reading

- Added favorite support to daily hotspot cards and GitHub daily cards.
- Recorded recent reading when the user opens hotspot original links, HN discussion links, GitHub repo links, or release links.
- Kept recent article reading for one week only.
- Added `/user` panels for favorite articles and recent articles, merging DB records with localStorage fallback.
- Filtered DB recent article readings to the latest seven days.

### Daily sync repair

- Fixed `scripts/sync-content.mjs` project root resolution.
- The previous script walked three directories above `scripts`, so generated JSON could be written outside the repo.
- The fixed script writes to `apps/web/src/data` inside `E:\code\learning-agent-platform`.

### Codeforces learning analysis and review plan persistence

- Removed the 24-hour frontend expiry for cached learning analysis and wrong-book review results.
- The cached full UI report remains available until the user regenerates and overwrites it.
- Added safe short summaries for learning reports and review plans into the existing assistant memory layer.
- Regeneration replaces the previous summary memory for that artifact kind.

### AI assistant user learning context

- Extended assistant learning context with:
  - Codeforces public account summary.
  - Learning report summary.
  - Review plan summary.
  - Recent code analysis summary.
- Added `learning-artifact-memory.ts` for safe, small artifact summaries.
- Recent code analysis now writes a short summary memory after analysis history is saved.
- The assistant prompt now explicitly allows the current logged-in user to view their own safe learning summaries.
- The prompt still forbids secrets, cookies, tokens, raw prompts, raw responses, hidden logs, and internal tools.

### Conversation and memory management

- Added a `New chat` control to start a fresh assistant conversation id and clear the current chat UI.
- Memory manager now loads the full overview, then separates:
  - Long-term memory.
  - Archived conversation summaries.
- Archived summaries can be viewed, deleted, or restored into long-term retrievable memory.
- Short-term working context remains agent-controlled and is not exposed as a manually managed list.

### Memory repository fix

- Updated `PrismaMemoryRepository.addMemory()` to respect `metadata.memoryType` when provided.
- This prevents restored long-term memories from being accidentally stored as `SESSION_SUMMARY` only because their category was `goal`.

## Verification

Passed twice:

```powershell
pnpm run typecheck
```

Observed result:

```text
PASS: typecheck 0 errors
```

HTTP smoke checks on the running dev server:

- `http://localhost:3000/user` -> 200
- `http://localhost:3000/articles` -> 200
- `http://localhost:3000/ai` -> 200

## Files

Added:

- `apps/web/src/lib/assistant/learning-artifact-memory.ts`
- `docs/rounds/codex/A506_codex.md`

Updated:

- `apps/web/src/app/articles/components/ArticleCenterTabs.tsx`
- `apps/web/src/app/user/page.tsx`
- `apps/web/src/app/user/article-recent-reading-db-loader.ts`
- `apps/web/src/app/user/CodeforcesDashboardClient.tsx`
- `apps/web/src/app/user/cf-learning-analysis-action.ts`
- `apps/web/src/app/user/cf-wrongbook-review-action.ts`
- `apps/web/src/app/ai/code-analysis-actions.ts`
- `apps/web/src/app/ai/AssistantMemoryManager.tsx`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`
- `apps/web/src/lib/local-user-article-store.ts`
- `apps/web/src/lib/assistant/assistant-types.ts`
- `apps/web/src/lib/assistant/user-learning-context.ts`
- `apps/web/src/lib/assistant/assistant-orchestrator.ts`
- `packages/db/src/repositories/memory-repository.ts`
- `scripts/sync-content.mjs`
- `docs/codex-context/CURRENT_HANDOFF.md`

## Not Implemented

- No Prisma migration.
- No new database table for full learning report storage.
- Full learning analysis and review-plan UI reports are still cached client-side; assistant memory stores only safe summaries.
- No production scheduler was installed or modified.
- No real external tool execution was enabled.
- No Git add, commit, push, or PR.

## Remaining Risk

- If the user's 9 AM scheduler calls another script or wrong working directory, that scheduler still needs to be inspected separately.
- Full learning report persistence should eventually move from browser cache to an explicit DB artifact table.
- Assistant learning summaries are intentionally compact, so the assistant can answer about available summaries but not reconstruct every raw record.
- The working tree contains many pre-existing unrelated modified/untracked files from earlier rounds; this round did not clean or revert them.

## Next Recommendation

Pick one small follow-up:

- Add a DB artifact repository for full learning analysis and review-plan reports.
- Add a small admin/scheduler status page showing the last successful daily content sync.
- Add tests for article recent-reading retention and assistant learning artifact summaries.
