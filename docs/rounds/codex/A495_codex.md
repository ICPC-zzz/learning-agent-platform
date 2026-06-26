# A495 Codex Report

## Scope

- Branch observed: `rescue/restore-full-project-20260623-163923`
- Task: recover source files with null bytes, truncation, or syntax damage; remove parser-level failures blocking `apps/web` startup.
- Out of scope followed: no business feature work, no Prisma changes, no Git write operations, no commit/push/stash/reset/restore, no broad TypeScript semantic cleanup.

## Pre-Repair State

- Read-only scan covered 828 target files under `apps/web/src`, `packages`, package JSON files, and tsconfig files.
- Corrupted / parser-broken files found: 16.
- Current scan diagnostics before repair:
  - 15 files had TS/TSX parser diagnostics with no current null bytes.
  - 1 file had 7169 null bytes and failed UTF-8 decode: `packages/ai-core/src/model-gateway/structured-generation.ts`.
- `pnpm -C apps/web typecheck` failed before repair with parser-level errors across these files.
- External source directories checked read-only:
  - `E:\code\lap-git-recovery-20260623-164752`
  - `E:\code\lap-git-recovery-20260623-165022`
  - `E:\code\learning-agent-platform-before-local-history-20260623-172511`
  - `E:\code\learning-agent-platform-forensic-20260623-164319`

Generated manifests:

- `.codex_tmp/a495_pre_repair_manifest.txt`
- `.codex_tmp/a495_corrupted_files.tsv`
- `.codex_tmp/a495_restore_log.tsv`
- `.codex_tmp/a495_post_restore_scan.json`

External A495 pre-repair backup:

- `E:\code\lap-a495-pre-repair-20260626024507`

## Restored Files

All restored files came from `E:\code\learning-agent-platform-before-local-history-20260623-172511`. Each candidate was checked before overwrite: no null bytes and TypeScript/TSX parse result `ok`.

| File | Null bytes before -> after | Source | SHA-256 before | SHA-256 after |
|---|---:|---|---|---|
| `apps/web/src/app/import/ImportedDraftShelfClient.tsx` | 0 -> 0 | physical backup | `b2cad72fcaf4cd3fb018dd4eded5587bb3ed311482a9fe71eaedc964cd28e2bb` | `a66e297f691a06f21617fdbdbdfcce24905071ee4e7c2f1729a80e6dfe67775f` |
| `apps/web/src/app/import/imported-draft-shelf-view-model.ts` | 0 -> 0 | physical backup | `3a5a8bc7e1b8139d7af8c56fdd84634cc41d590b738ff00bd747cb98c5650f8a` | `fff6a5cc5247a0768a0e157489e10f8ea383245647649abe4372ba13aa5e963d` |
| `apps/web/src/app/import/text-import-confirmation.ts` | 0 -> 0 | physical backup | `9cd8544b0731bb0972f79c4ed20dcbadce9b629075de2648c44d0d5c19306c99` | `3584f1cd85c31e5981bac847ace9f036a5b0c1a58d7595bee68aec420a2f87ac` |
| `apps/web/src/app/import/text-import-preview.ts` | 0 -> 0 | physical backup | `2f20c7e55802f0d6b8b8dbba2547cdc5e382038f6570f9ee8a16f1155b047433` | `759fb434da47a29e473b34e84e78156fd09dd37b22f391c38df4fcfcec0306a8` |
| `apps/web/src/app/reader/ReaderSyncDevTriggerPreview.tsx` | 0 -> 0 | physical backup | `e31e8e6d7b92e2848bd1f2b2c8ad45cd4b2858057db14d39fe552f737ee631f9` | `43658e54bc16e1c1b459d671a1ae2b2adbeb50611c9f058d196fbe6032180e12` |
| `apps/web/src/app/reader/reader-progress-sync-service.ts` | 0 -> 0 | physical backup | `4c3f73080b896b122b1644cd6e9374b1d1d86b62fda82c160b439791eee26f4d` | `ef1c9f0b2db2a53f9118177590aaf25d211ad5086c93dbebd9ce852136e4b840` |
| `apps/web/src/app/reader/reader-sync-draft.ts` | 0 -> 0 | physical backup | `8cd397a21ef7465f1bf4ae46773f40adda52385c869031882bd1408a67f20d4e` | `efda489c19dfe2790bb847a3e6b793f3b78a3c2e9d1a089b090f656abe9c7ca0` |
| `apps/web/src/app/reader/reader-sync-idempotency-conflict.ts` | 0 -> 0 | physical backup | `11284e2aa1d3882e963b7deb51bd2dba574598ca3a483bdea6cf5c9c50535ba5` | `c0a8bd96c6f42f60ade5cf71a88b2d1cba911883d8ae9ae0811701d06a1180c5` |
| `apps/web/src/app/reader/reader-sync-noop-server-action-core.ts` | 0 -> 0 | physical backup | `4fd64ae8d8fb3ea5817db0fa8173277f3fe8ef9911b4dbe2d9e667991ddefa64` | `ccda35cf8a8efd7f89224ad93f54bd6b1f1cbe6f79e57ceb4083127e13037c3c` |
| `apps/web/src/app/reader/reader-sync-preview.ts` | 0 -> 0 | physical backup | `47c596c064d5f7df91a3df2a2400d24a62298dec87b0963337f3be95e11d06b0` | `4ac20fd3e684cbd639d627dd454c8d1c9e400b648034f6233cf1fc2375c74156` |
| `apps/web/src/app/reader/reader-sync-real-server-action-core.ts` | 0 -> 0 | physical backup | `2ccf447439d6d2ad221d39d86846ea8b0025b343bbf3df2e2ad5aee9b84eef63` | `8a121d444da60b4853df00440dc56aeb408fd652e33663c82e267fd71e8f8d61` |
| `apps/web/src/app/reader/reader-sync-real-server-action.server.ts` | 0 -> 0 | physical backup | `28cc371fdb89c51570cbf46dbe1e37d71311ce19671b5258b974014a32ca675a` | `a0afb3a651424015834b151ade4c12086554481e85a4c6597664ddf37729508d` |
| `apps/web/src/app/reader/reader-sync-real-server-action.ts` | 0 -> 0 | physical backup | `6fb14bf9fa25bb7ad7b9fca38d50c455c0e8f4217fbd5877c0fb0c1a0a29a176` | `6f79a0b0dcd3548c696c42db799f130c09ebc5b29d9149a26b8c9d986fe4fe0d` |
| `apps/web/src/app/reader/reader-sync-request-context.ts` | 0 -> 0 | physical backup | `595a3e287391a900742785459f8be047c797c51a30586ec43cd0a9254d8fef1f` | `df16d59c1d644c3217742bed452226f5aec9eb27700113dab72fad4cb5ac890e` |
| `apps/web/src/app/reader/reader-sync-safe-server-context.ts` | 0 -> 0 | physical backup | `f4cd376a6a5472f6323a1b6123c5e2ee91ede0635c601a3efeb30520812f90fc` | `c87dc68fcd8d843f1a1b196e89ce6198b1f558ff978aa85ae6255b68c0ebd931` |
| `packages/ai-core/src/model-gateway/structured-generation.ts` | 7169 -> 0 | physical backup | `de076df4d62cf45d4b79a631eb7b71cb07058ff142eff446e3f48224e1713709` | `7af4eb309a8e905b076c927994affe9b4ef81247ca45d8926223658b005e5676` |

Manual reconstruction: none.

Unresolved corrupted files: none.

## Parser Error Result

- Post-restore structural scan: 828 files scanned, 0 bad files.
- `apps/web` parser-level TypeScript errors: 0 after restore.
- Remaining `apps/web` semantic/typecheck errors: 308 error lines.
- Remaining error codes are semantic / contract-level, including `TS2322`, `TS2339`, `TS2307`, `TS2578`, `TS7006`, `TS2345`, and related codes.

## Web Startup Result

Command:

```powershell
pnpm -C apps/web dev
```

Result:

- Next.js 15.5.18 started.
- Local URL: `http://localhost:3000`
- Ready in 4.9s.
- Homepage request:

```powershell
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

- HTTP status: 200
- Response length: 22523
- Homepage compile log: `GET / 200 in 1910ms`

First non-parser warning during dev compile:

- `src/lib/assistant/memory-service.ts` imports memory helpers not exported from `@learning-agent-platform/ai-core`, including `summarizeWorkingMemoryMessages`, `buildMemoryContextBundle`, `retrieveRelevantMemories`, `extractMemoryCandidates`, and `isForgetRequest`.
- This is a module contract/export mismatch, not a source truncation or parser failure.

The dev server was left running for manual inspection:

- PID: `6240`

## Core Package Regression

All required core package typechecks stayed green:

```powershell
pnpm -C packages/db typecheck              # exit=0
pnpm -C packages/ai-core typecheck         # exit=0
pnpm -C packages/book-engine typecheck     # exit=0
pnpm -C packages/shared typecheck          # exit=0
```

## Git State

Read-only Git checks succeeded:

```powershell
git rev-parse --show-toplevel
git rev-parse HEAD
git cat-file -t HEAD
git cat-file -t backup/a492-before-rollback-20260623-163719
git cat-file -t backup/safety-stash-20260623-163923
git cat-file -t 74ae644
git cat-file -t 4f46663
git cat-file -t 2c293a5
```

Observed HEAD:

```text
c8d4e435c3dafb9f2bc623faf538b32630c3724c
```

Safety refs are still readable as commit objects:

- `HEAD`
- `backup/a492-before-rollback-20260623-163719`
- `backup/safety-stash-20260623-163923`
- `74ae644`
- `4f46663`
- `2c293a5`

`git status --short` succeeded in this run. It did not reproduce the A494 `unknown index entry format` failure. The worktree remains heavily dirty from prior rounds plus this repair; no Git write operations were performed.

No `git status` failure error was present in this run.

## Explicitly Not Executed

- `git add`
- `git commit`
- `git push`
- `git reset`
- `git restore`
- `git stash`
- Prisma migration
- Prisma `db push`
- Prisma reset
- Any database write operation

## Remaining Work For A496

Only after this source recovery baseline, handle semantic errors in `apps/web` in small groups:

1. Resolve stale `@ts-expect-error` directives reintroduced by restored backup files.
2. Fix current module export mismatches between `apps/web` and `packages/ai-core` / `packages/db` / `packages/learning-engine`.
3. Address missing local module paths under `apps/web/src/app/problems` and `apps/web/src/lib`.
4. Re-run `pnpm -C apps/web typecheck` after each small group.
5. Keep Agent / Tool / Provider behavior preview-only / disabled-by-default while fixing contracts.

Project total progress remains: 61.00%.
