# A402 — Web Real Book API Access Step 1: Book Source Provider dev-only guarded adapter v1

**Model**: Claude Sonnet (Claude Code)
**Mode**: Claude Code (Web learning loop)
**Date**: 2026-06-11

## 1. Modified Files

### New files: packages/book-engine

- `packages/book-engine/src/book-source-provider.ts` — Book Source Provider contract: interfaces
  (`BookSourceProvider`, `BookSourceProviderSafetyMetadata`,
  `NormalizedBookMetadata`, `BookSearchParams`, `BookSearchResult`,
  `BookDetailResult`, `NormalizedChapterPreview`), safety metadata helpers
  (`createBlockedSafetyMetadata`, `createPassedSafetyMetadata`,
  `createErrorSafetyMetadata`, `createEmptySearchResult`,
  `createEmptyDetailResult`). 213 lines.

- `packages/book-engine/src/book-source-provider.test.mjs` — 13 tests: contract types,
  safety metadata helpers, empty result factories, secret leak prevention.

- `packages/book-engine/src/dev-http-book-source-provider.ts` — Dev-only HTTP adapter
  implementing `BookSourceProvider` with 3-layer guard
  (`LAP_BOOK_API_DEV_ENABLED`, `LAP_ALLOW_EXTERNAL_BOOK_API`,
  `LAP_BOOK_API_BASE_URL`), injectable fetch, timeout/abort via
  `AbortController`, response normalization (only known safe fields extracted),
  error-safe truncation. ~400 lines.

- `packages/book-engine/src/dev-http-book-source-provider.test.mjs` — 31 tests:
  guard defaults (all off), individual guard missing, guard passed with fake
  fetch, response normalization, author parsing, extra/sensitive field
  exclusion, raw response not stored, network/HTTP/timeout errors, language
  parameter, safety metadata on all paths, no LLM/DB calls.

### New files: apps/web import preview

- `apps/web/src/app/import/book-api-preview.ts` — Book API preview service
  wrapping the `BookSourceProvider` contract for the import UI. Returns
  `BookApiPreviewViewModel` with blocked preview, success preview, error
  preview, and built-in fallback suggestions. ~165 lines.

- `apps/web/src/app/import/book-api-preview.test.mjs` — 14 tests: guard blocked,
  guard passed, empty results, provider error, safety metadata on all paths,
  no LLM/DB, query preservation, fallback suggestions, multi-book mapping,
  importable always false.

### Modified files

- `packages/book-engine/src/index.ts` — Added exports for Book Source Provider
  types and functions, plus `DevHttpBookSourceProvider` and
  `createDevHttpBookSourceProvider`.

## 2. Book Source Provider contract location and types

**Location**: `packages/book-engine/src/book-source-provider.ts`

**Key types**:

- `BookSourceProvider` — interface with `searchBooks()`, `getBookDetail()`,
  `getGuardStatus()`, `providerId`, `isRealApiEnabled`
- `BookSourceProviderSafetyMetadata` — always-carried safety block:
  `productionReady: false`, `llmUsed: false`, `writesDatabase: false`,
  `rawResponseStored: false`, `safeToExposeToClient: true`,
  `guardBlocked`, `blockedReasons[]`, `fallbackSource`
- `NormalizedBookMetadata` — safe book metadata: `providerId`, `externalBookId`,
  `title`, `authors[]`, `description`, `language`, `sourceUrl`,
  `licenseHint`, `coverImageUrl`, `chapterPreviewCount`, `importable: false`,
  `safety`
- `BookSearchParams` — `query`, `maxResults?`, `language?`
- `BookSearchResult`, `BookDetailResult` — result wrappers with safety metadata
- `NormalizedChapterPreview` — no body content, metadata only

## 3. Dev-only HTTP adapter guard conditions

The `DevHttpBookSourceProvider` requires ALL three conditions:

1. `LAP_BOOK_API_DEV_ENABLED === "1"` or `"true"`
2. `LAP_ALLOW_EXTERNAL_BOOK_API === "1"` or `"true"`
3. `LAP_BOOK_API_BASE_URL` is set and non-empty

When any guard is missing:
- No fetch call is made
- Returns `{ books: [], totalResults: 0 }` with blocked safety metadata
- `guardBlocked: true`, `externalApiUsed: false`
- `fallbackSource: "empty"`

When all guards pass via injected env override:
- Uses injected `fetch` function (real or fake for testing)
- Calls `GET {baseUrl}/search?q=...` and `GET {baseUrl}/books/{id}`
- Normalizes response into safe fields only (no raw response stored)
- Timeout enforced via `AbortController` (default 10s)

## 4. Default: does it call external API?

**否 (No).** All three guard env vars default to off/empty. No real HTTP request
is ever made without explicit opt-in. All tests use fake fetch.

## 5. Default: does it write to DB?

**否 (No).** All safety metadata carries `writesDatabase: false`. No Prisma
calls, no repository writes, no schema changes. No `prisma migrate` or
`prisma generate` executed.

## 6. Does it call LLM?

**否 (No).** All safety metadata carries `llmUsed: false`. No AI provider
calls, no tool executions, no agent loops.

## 7. Does it save raw provider response?

**否 (No).** All safety metadata carries `rawResponseStored: false`. The
adapter only extracts known safe fields from provider responses. Extra/
unknown fields are silently dropped. Raw response objects are never stored
or returned.

## 8. Fallback strategy

| Scenario | Behavior |
|----------|----------|
| Guards blocked (default) | Returns empty preview + built-in fallback suggestions |
| Guard passed, no results | Returns empty books + built-in fallback suggestions |
| Guard passed, provider error | Returns empty books + error reason + fallback suggestions |
| Guard passed, success | Returns normalized book metadata, no fallback needed |

Built-in fallback suggestions include:
- "使用项目内置示例书籍"
- "通过「文本导入」粘贴纯文本内容"
- "外部书籍 API 默认关闭，需配置环境变量后启用"

## 9. New/updated tests and results

### A402 new tests

| Test file | Pass | Fail |
|-----------|------|------|
| book-source-provider.test.mjs | 13 | 0 |
| dev-http-book-source-provider.test.mjs | 31 | 0 |
| book-api-preview.test.mjs | 14 | 0 |
| **A402 total new** | **58** | **0** |

### Combined regression + new tests

| Scope | Pass | Fail |
|-------|------|------|
| packages/book-engine/*.test.mjs (new) | 44 | 0 |
| apps/web/src/app/import/*.test.mjs (new + existing) | 68 | 0 |
| **Total** | **112** | **0** |

All existing import tests continue to pass — no regressions.

## 10. Lint / typecheck results

- **Lint**: PASS (0 errors on new .ts files via TS syntax check)
- **Typecheck**: PASS (0 errors via `bash scripts/vm-typecheck.sh`)

## 11. Does this round need follow-up provider config/auth?

**Yes.** This round established the provider contract and dev-only HTTP adapter
boundary, but no real provider (Google Books, Open Library, etc.) has been
configured. A future round would need to:

1. Decide on a target external book API
2. Add authorization (API key, OAuth, or public endpoint)
3. Create a concrete provider implementation (e.g. `GoogleBooksProvider`)
4. Map the external API's response shape into `NormalizedBookMetadata`
5. Expand chapter preview extraction if desired
6. Keep all existing guards and safety metadata

This round intentionally does NOT do any of the above.

## 12. Unfinished risks

- Chapter preview extraction is empty (bodyAvailable always false) — by design
  for this round
- No real external API provider is configured — needs separate auth/config round
- No UI integration for the book API preview service — the import page still
  shows only the text import tab; a future round could add an "API Search" tab
- `DevHttpBookSourceProvider` uses `.ts` import extensions (not `.js`) to
  support native Node.js `--test` runner — this is consistent with how the
  test files import, but may need adjustment if the project migrates to a
  bundler-based test runner
- No browser/GUI acceptance verification (prohibited by this round's scope)
- No dev server start (prohibited by this round's scope)

## 13. Project total progress

**88.00%** (adjusted from 87.50%, +0.50%)

Reason: Book Source Provider contract + dev-only HTTP adapter + import
preview service represent the first real API boundary for external book
content. 58 new tests, 0 regressions, lint/typecheck 0 errors. All
disabled-by-default with guard protection.

## 14. Skip reasons

- No real external API calls (all guards disabled by default, fake fetch in tests)
- No DB writes (`writesDatabase: false` on all paths)
- No LLM calls (`llmUsed: false` on all paths)
- No raw response storage (`rawResponseStored: false`)
- No Prisma migration / schema change
- No dev server start
- No browser/GUI verification
- No Desktop modifications
- No `prisma migrate dev` / `prisma db push` / `prisma generate`
- No sensitive data exposed
- No real provider integration (Google Books, Open Library, etc.)

## 15. Safety boundary confirmation

- No API key / token / secret / DATABASE_URL value exposed
- All blocked reasons reference env var NAMES only, not values
- All metadata has `safeToExposeToClient: true`
- All metadata has `productionReady: false`
- All metadata has `llmUsed: false`
- All metadata has `writesDatabase: false`
- All metadata has `rawResponseStored: false`
- No raw prompt/response saved
- Error messages sanitized (URL query strings stripped)
- Book API disabled by default
- No real HTTP calls without explicit opt-in
