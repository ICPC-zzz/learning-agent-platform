# A496 Codex Report - apps/web semantic type errors v1

## 1. Task Scope

- Scope: only fix TypeScript semantic errors for `apps/web`.
- Goal: reduce `apps/web` TypeScript error count to less than 100.
- Non-goals: no business feature progress, no broad refactor, no reference project reading.
- Project progress remains: **61.00%**.
- This round is type-only cleanup and compatibility repair. It does not add business progress.

## 2. Initial Typecheck Result

Command:

```bash
pnpm -C apps/web typecheck *> .codex_tmp/a496_web_initial.log
```

Initial total TypeScript errors: **308**.

Initial error code stats:

| Code | Count |
| --- | ---: |
| TS2322 | 51 |
| TS2578 | 51 |
| TS2339 | 35 |
| TS7006 | 34 |
| TS2307 | 31 |
| TS2305 | 26 |
| TS2345 | 22 |
| TS2724 | 13 |
| TS2367 | 7 |
| TS2739 | 5 |
| TS18048 | 5 |
| TS18046 | 5 |
| TS2554 | 4 |
| TS2352 | 4 |
| TS2459 | 3 |
| TS2551 | 2 |
| TS2312 | 2 |
| TS18047 | 2 |
| TS2614 | 1 |
| TS2304 | 1 |
| TS2741 | 1 |
| TS2552 | 1 |
| TS7053 | 1 |
| TS2403 | 1 |

Initial business directory distribution:

| Area | Count |
| --- | ---: |
| `app/user` | 71 |
| `app/reader` | 68 |
| `lib` | 58 |
| `lib/assistant` | 34 |
| `app/problems` | 26 |
| `app/import` | 26 |
| `app/books` | 15 |
| `components/problems` | 4 |
| `app/ai` | 3 |
| `app/agent` | 2 |
| `packages/learning-engine` | 1 |

Initial parser-level selected syntax errors: **0**.

## 3. Public API Root Causes

- `@learning-agent-platform/ai-core`: memory module exports were incomplete for Web usage. `apps/web` imports memory helpers and working-memory message types through package public surfaces.
- `@learning-agent-platform/db`: public barrels did not expose several repository classes and shared repository types used by Web server actions and loaders.
- `BookRepository` compatibility: Web book actions expected delete/update metadata operations and list/create result fields that were absent or narrower in the public contract.
- `@learning-agent-platform/book-engine`: root export still reflected an older imported draft contract, while Web imports expected the current book API import draft surface.
- `@learning-agent-platform/learning-engine`: problem API provider exports were not available from the package root.
- `@learning-agent-platform/shared`: root export had stale local declarations instead of forwarding the current external API guard/config modules.
- `apps/web` import drift: several Web files referenced package internals, stale relative paths, or local-store singleton names that no longer matched the available APIs.
- A495 parser cleanup left many `@ts-expect-error` comments unused after syntax-level issues were removed.

## 4. Changes Made

Package export and contract compatibility:

- `packages/ai-core/src/memory/index.ts`
- `packages/db/src/index.ts`
- `packages/db/src/repositories/index.ts`
- `packages/db/src/repositories/book-repository.ts`
- `packages/db/src/types.ts`
- `packages/learning-engine/src/index.ts`
- `packages/book-engine/src/index.ts`
- `packages/shared/src/index.ts`

Web path, type, and adapter fixes:

- `apps/web/src/app/problems/ProblemLibraryClient.tsx`
- `apps/web/src/app/problems/[problemId]/ProblemPracticeActivityControl.tsx`
- `apps/web/src/app/problems/[problemId]/ProblemWrongBookControl.tsx`
- `apps/web/src/app/problems/problem-api-preview-server-action.ts`
- `apps/web/src/app/user/favorites/books/page.tsx`
- `apps/web/src/app/user/favorites/books/favorite-books-page-client.tsx`
- `apps/web/src/app/user/favorites/problems/favorite-problems-page-view-model.ts`
- `apps/web/src/app/user/recent-reading/recent-reading-page-client.tsx`
- `apps/web/src/app/user/recent-reading/recent-reading-page-view-model.ts`
- `apps/web/src/app/user/bookmarks/UserBookmarksClientHydration.tsx`
- `apps/web/src/app/user/notes/UserNotesClientHydration.tsx`
- `apps/web/src/app/user/user-dashboard-learning-stats-view-model.ts`
- `apps/web/src/app/user/today/user-today-plan-view-model.ts`
- `apps/web/src/app/user/report/user-learning-report-view-model.ts`
- `apps/web/src/app/user/article-favorites-db-server-action.ts`
- `apps/web/src/app/user/article-favorites-db-loader.ts`
- `apps/web/src/app/user/favorites-db-server-action.ts`
- `apps/web/src/app/reader/ReaderPageContent.tsx`
- `apps/web/src/app/import/book-api-import-server-action.ts`
- `apps/web/src/lib/assistant/memory-service.ts`
- `apps/web/src/lib/assistant/page-context.ts`
- `apps/web/src/lib/learning-insight-local-data.ts`
- `apps/web/src/lib/local-user-library-store.ts`
- `apps/web/src/lib/local-user-problem-store.ts`
- `apps/web/src/lib/local-reader-ai-history-store.ts`
- `apps/web/src/lib/judge/language-runners.ts`
- `apps/web/src/components/problems/FavoriteProblemButton.tsx`
- `apps/web/src/components/problems/ProblemPracticeStatusControl.tsx`
- `apps/web/src/lib/docx-import-server-action.ts`
- `apps/web/src/lib/pdf-import-server-action.ts`

Unused `@ts-expect-error` cleanup, limited to locations reported as TS2578:

- `apps/web/src/app/import/ImportedDraftShelfClient.tsx`
- `apps/web/src/app/import/imported-draft-shelf-view-model.ts`
- `apps/web/src/app/import/text-import-confirmation.ts`
- `apps/web/src/app/import/text-import-preview.ts`
- `apps/web/src/app/reader/reader-progress-sync-service.ts`
- `apps/web/src/app/reader/ReaderSyncDevTriggerPreview.tsx`
- `apps/web/src/app/reader/reader-sync-draft.ts`
- `apps/web/src/app/reader/reader-sync-idempotency-conflict.ts`
- `apps/web/src/app/reader/reader-sync-noop-server-action-core.ts`
- `apps/web/src/app/reader/reader-sync-preview.ts`
- `apps/web/src/app/reader/reader-sync-real-server-action.server.ts`
- `apps/web/src/app/reader/reader-sync-real-server-action.ts`
- `apps/web/src/app/reader/reader-sync-real-server-action-core.ts`
- `apps/web/src/app/reader/reader-sync-request-context.ts`
- `apps/web/src/app/reader/reader-sync-safe-server-context.ts`

Package exports modified: **yes**.

## 5. Error Count Progression

| Step | Error Count |
| --- | ---: |
| Initial | 308 |
| After first exports/path fixes | 282 |
| After unused `@ts-expect-error` cleanup | 231 |
| After second path/export pass | 208 |
| After view-model and reader fixes | 173 |
| After memory/import/problem fixes | 146 |
| After shared barrel fixes | 127 |
| After book repository compatibility | 120 |
| After article import fixes | 105 |
| Final verification | 94 |

## 6. Final apps/web Typecheck Result

Command:

```bash
pnpm -C apps/web typecheck *> .codex_tmp/a496_web_final_verify.log
```

Result:

- Exit code: `1`
- Final TypeScript errors: **94**
- Parser-level selected syntax errors: **0**

Final error code stats:

| Code | Count |
| --- | ---: |
| TS2322 | 26 |
| TS2339 | 22 |
| TS2345 | 20 |
| TS18046 | 5 |
| TS2554 | 4 |
| TS2367 | 4 |
| TS2352 | 4 |
| TS18048 | 2 |
| TS2307 | 1 |
| TS2305 | 1 |
| TS7006 | 1 |
| TS2614 | 1 |
| TS2741 | 1 |
| TS2552 | 1 |
| TS2459 | 1 |

Final business directory distribution:

| Area | Count |
| --- | ---: |
| `lib` | 23 |
| `app/books` | 17 |
| `lib/assistant` | 13 |
| `app/user` | 13 |
| `app/reader` | 11 |
| `app/import` | 9 |
| `app/problems` | 3 |
| `app/agent` | 2 |
| `packages/learning-engine` | 1 |
| `app/ai` | 1 |
| `components/problems` | 1 |

Top remaining files:

| File | Count |
| --- | ---: |
| `src/app/books/manage/actions.ts` | 11 |
| `src/app/import/imported-draft-db-write-adapter.ts` | 6 |
| `src/app/user/cf-learning-analysis-action.ts` | 5 |
| `src/lib/github-daily-report-sync.ts` | 5 |
| `src/app/reader/reader-sync-db-write-adapter.ts` | 5 |
| `src/lib/assistant/assistant-orchestrator.ts` | 5 |
| `src/lib/assistant/tools/tool-registry.ts` | 4 |
| `src/app/reader/reader-progress-dev-smoke-runner.ts` | 4 |
| `src/app/books/delete-book-actions.ts` | 4 |
| `src/lib/open-library-client.ts` | 3 |

## 7. Core Package Validation

| Command | Exit | TS Errors |
| --- | ---: | ---: |
| `pnpm -C packages/db typecheck` | 0 | 0 |
| `pnpm -C packages/ai-core typecheck` | 0 | 0 |
| `pnpm -C packages/book-engine typecheck` | 0 | 0 |
| `pnpm -C packages/shared typecheck` | 0 | 0 |

## 8. Web Dev Server Validation

Existing dev server on port `3000` responded successfully.

Command:

```bash
Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 10
```

Result:

- Homepage HTTP status: **200**
- Response length: `22523`

## 9. Commands Run

- `pnpm -C apps/web typecheck`
- `pnpm -C packages/db typecheck`
- `pnpm -C packages/ai-core typecheck`
- `pnpm -C packages/book-engine typecheck`
- `pnpm -C packages/shared typecheck`
- `Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 10`
- `git status --short` for read-only status inspection

No real LLM, tool execution loop, Skill execution loop, or Agent autonomy loop was executed.

## 10. Remaining Error Groups

Remaining 94 errors are primarily:

- Data-shape and contract mismatches: **82** errors across `TS2322`, `TS2339`, `TS2345`, `TS2741`, `TS2554`, `TS2352`, `TS2367`, `TS2552`.
- Null/unknown narrowing: **7** errors across `TS18046`, `TS18048`.
- Remaining missing module/export/private export issues: **4** errors across `TS2307`, `TS2305`, `TS2614`, `TS2459`.
- Remaining implicit any: **1** error, `TS7006`.

Recommended future rounds:

- Align book delete/update action result contracts with `BookRepository` return types.
- Finish import/reader DB write adapter contract normalization.
- Repair assistant tool registry and orchestrator data-shape drift.
- Expose or replace remaining stale DB/problem repository imports, especially `PrismaProblemRepository`.
- Narrow unknown/null values in user analysis, GitHub report sync, and external provider adapters.

## 11. Git Worktree Status

Read-only status inspection showed the whole repository is already dirty:

- Total `git status --short` entries: **513**
- Modified entries: **90**
- Untracked entries: **423**
- Deleted entries: **36**

This includes many files outside the A496 touch set. No attempt was made to clean, stage, revert, or separate unrelated existing changes.

## 12. Forbidden Actions Confirmation

Not executed:

- `git add`
- `git commit`
- `git push`
- `git reset`
- `git restore`
- `git stash`
- Prisma migration commands

