# A403 — Web Real Book API Access Step 2: Open Library dev-only provider + Import 页面预览入口

**Model**: Claude Sonnet (Claude Code)
**Mode**: Claude Code (Web learning loop)
**Date**: 2026-06-11

## 1. Modified Files

### New files: packages/book-engine

- `packages/book-engine/src/open-library-book-source-provider.ts` — Open Library dev-only
  BookSourceProvider adapter. Maps Open Library search.json and works/{id}.json responses
  into NormalizedBookMetadata. 4-layer guard (LAP_BOOK_API_DEV_ENABLED,
  LAP_ALLOW_EXTERNAL_BOOK_API, LAP_BOOK_API_BASE_URL, LAP_BOOK_API_PROVIDER),
  injectable fetch, timeout via AbortController, response normalization with only known
  safe fields extracted, cover image URL building, author extraction from both search doc
  and work detail shapes, description normalization (string and object forms),
  language array handling. ~410 lines.

- `packages/book-engine/src/open-library-book-source-provider.test.mjs` — 47 tests:
  guard defaults (all 4 off), individual guard missing, provider selector (open-library in
  comma list), search via fake fetch with URL verification, detail via fake fetch with
  /works/ prefix stripping, search doc normalization (title, authors, language array/string,
  missing cover, description), work detail normalization (string desc, object desc, missing
  authors/covers), extra/sensitive field exclusion, raw response not stored, error handling
  (fetch throw, HTTP non-OK, null body, non-object response), error message secret leak
  prevention, safety metadata on all paths, no LLM/DB in all paths, chapter previews empty,
  multiple results, language parameter in URL, no real fetch when guards off.

### New files: apps/web import preview

- `apps/web/src/app/import/BookApiPreviewClient.tsx` — Client component for the Book API
  preview panel on the import page. Uses previewBookApiSearch with Open Library provider.
  Shows blocked notice (with env var config hints), idle/success/error states, book result
  cards with cover images, safety badges. Default `apiEnabled={false}` ensures no network
  calls. ~260 lines.

- `apps/web/src/app/import/book-api-preview-view-model.ts` — View model types and helpers
  for the Book API preview UI. Defines BookApiPreviewUIState, BookApiPreviewStatus
  (blocked/idle/loading/success/error), factory functions for each state, and safety badge
  labels. ~85 lines.

### Modified files

- `packages/book-engine/src/index.ts` — Added exports for OpenLibraryBookSourceProvider
  and createOpenLibraryBookSourceProvider.

- `apps/web/src/app/import/page.tsx` — Added import of BookApiPreviewClient and rendered
  `<BookApiPreviewClient apiEnabled={false} />` below the existing text import client.
  Minimal change — 2 lines added.

## 2. Open Library provider adapter location

**Location**: `packages/book-engine/src/open-library-book-source-provider.ts`

**providerId**: `"open-library-dev"`

**Capabilities**:
- `searchBooks(query)` → maps Open Library `search.json` response (`{ numFound, docs[] }`)
  to `NormalizedBookMetadata[]`
- `getBookDetail(externalBookId)` → maps Open Library `works/{id}.json` response to
  `NormalizedBookMetadata`
- Accepts both `"OL123W"` and `"/works/OL123W"` formats for externalBookId
- Extracts cover images from `cover_i` (search) and `covers[]` (detail)
- Normalizes description from both string and `{ type, value }` object forms
- Extracts authors from `author_name[]` (search) and `authors[]` (detail)
- Handles `language` as array (takes first element) or string
- All unknown/sensitive fields silently dropped
- Never stores raw response
- `llmUsed=false`, `writesDatabase=false`, `rawResponseStored=false`, `productionReady=false`

## 3. Guard conditions

The OpenLibraryBookSourceProvider requires ALL four conditions:

1. `LAP_BOOK_API_DEV_ENABLED === "1"` or `"true"`
2. `LAP_ALLOW_EXTERNAL_BOOK_API === "1"` or `"true"`
3. `LAP_BOOK_API_BASE_URL` is set and non-empty (defaults to `https://openlibrary.org`
   only after all guards pass)
4. `LAP_BOOK_API_PROVIDER` includes `"open-library"` (comma-separated list supported)

When any guard is missing:
- No fetch call is made
- Returns `{ books: [], totalResults: 0 }` with blocked safety metadata
- `guardBlocked: true`, `externalApiUsed: false`
- `fallbackSource: "empty"`

## 4. Import page preview entry

The import page (`apps/web/src/app/import/page.tsx`) now includes a
`<BookApiPreviewClient apiEnabled={false} />` component below the existing text import
client. This adds a minimal UI section with:

- Left panel: search input + button + safety badges (开发预览, 外部书籍 API 默认关闭,
  未调用 LLM, 未写入数据库, 未导入真实书籍, 不保存原始响应, 仅展示 normalized metadata)
- Right panel: blocked notice (shows env vars needed) / idle prompt / loading indicator /
  success results (book cards with cover images) / error display
- Default `apiEnabled={false}` ensures all guards are blocked — no network calls possible
- Blocked notice shows exact env var names to enable Open Library preview

## 5. Does it call external API by default?

**否 (No).** All four guard env vars default to off/empty. The BookApiPreviewClient
component is rendered with `apiEnabled={false}`, which forces all guard checks to fail.
No real HTTP request is ever made without explicit opt-in. All 47 provider tests use
fake fetch.

## 6. Does it write to DB?

**否 (No).** All safety metadata carries `writesDatabase: false`. No Prisma calls,
no repository writes, no schema changes. No `prisma migrate` or `prisma generate`
executed.

## 7. Does it call LLM?

**否 (No).** All safety metadata carries `llmUsed: false`. No AI provider calls,
no tool executions, no agent loops.

## 8. Does it save raw provider response?

**否 (No).** All safety metadata carries `rawResponseStored: false`. The adapter
only extracts known safe fields from Open Library responses. Extra/unknown fields
(OE-specific fields like `ebook_count_i`, `publisher`, `isbn`, `subject`, etc.)
are silently dropped. Raw response objects are never stored or returned.

## 9. Fake fetch test coverage

### New tests: open-library-book-source-provider.test.mjs (47 tests)

| Category | Count | Details |
|----------|-------|---------|
| Guard defaults (all 4 off) | 4 | search, detail, getGuardStatus, isRealApiEnabled |
| Individual guard missing | 5 | DEV_ENABLED, ALLOW_EXTERNAL, BASE_URL, PROVIDER missing, PROVIDER mismatch |
| Provider comma-list | 1 | "google-books, open-library, internal" passes |
| Guard passed → fetch with URL | 2 | search URL includes search.json, detail URL includes works/{id}.json |
| /works/ prefix stripping | 1 | detail with /works/OL123W doesn't double-prefix |
| Search doc normalization | 7 | title, authors, description, language array/string, missing cover, empty docs, single author string |
| totalResults from numFound | 1 | numFound=42 |
| Work detail normalization | 5 | full detail, string desc, object desc, missing authors, missing covers |
| Extra/sensitive field exclusion | 2 | search (ebook_count_i, publisher, isbn not leaked), detail (secret, token not leaked) |
| Raw response not stored | 2 | search and detail |
| Error handling | 5 | fetch throw, HTTP 404, null body, non-object response, error secret leak |
| Safety metadata | 3 | success search, success detail, blocked result |
| No LLM/DB in all paths | 2 | all 3 paths verified |
| providerId | 1 | always "open-library-dev" |
| Chapter previews empty | 1 | always [] |
| Multiple results | 1 | 3 docs |
| Language param | 2 | included when provided, omitted when not |
| No real fetch (default constructor) | 1 | guards off → no fetch |

### Existing tests (no regression)

| Test file | Pass | Notes |
|-----------|------|-------|
| book-source-provider.test.mjs | 13 | A402 contract tests — unchanged |
| dev-http-book-source-provider.test.mjs | 31 | A402 dev HTTP tests — unchanged |
| book-api-preview.test.mjs | 14 | A402 preview service tests — unchanged |
| All other import tests | 54 | Text import, save, confirm, edit, persist — unchanged |

### Combined results

| Scope | Pass | Fail |
|-------|------|------|
| packages/book-engine/*.test.mjs | 91 | 0 |
| apps/web/src/app/import/*.test.mjs | 68 | 0 |
| **Total** | **159** | **0** |

## 10. Lint / typecheck results

- **Lint**: PASS (exit 0) via `bash scripts/vm-lint.sh`
- **Typecheck**: Environment issue — `tee: /dev/stderr: Permission denied` in
  `vm-typecheck.sh`. This is a pre-existing VM environment limitation, not caused
  by A403 changes. Syntax check on all 3 new files passes individually.
- **Test**: ALL 91 book-engine tests pass, ALL 68 import tests pass

## 11. To enable real Open Library preview

To actually use the Open Library provider (for real browsing, not just tests), set:

```bash
LAP_BOOK_API_DEV_ENABLED=1
LAP_ALLOW_EXTERNAL_BOOK_API=1
LAP_BOOK_API_BASE_URL=https://openlibrary.org
LAP_BOOK_API_PROVIDER=open-library
```

These are ALL required. Without any one, the provider returns blocked metadata with
no fetch calls.

The import page component `BookApiPreviewClient` would also need `apiEnabled={true}`
(or the page would need to read env and pass it as a prop).

## 12. Unfinished risks

- Chapter body content extraction is empty (bodyAvailable always false) — by design
  for this round
- No real API key / auth needed (Open Library is public), but the adapter still
  requires explicit opt-in via all 4 env vars
- UI component uses client-side fetch injection, but in a real browser the
  `createOpenLibraryBookSourceProvider()` would use real `globalThis.fetch` — the
  component sets `apiEnabled={false}` by default to prevent this
- Typecheck script has a VM environment issue (pre-existing), cannot be verified
  in this environment
- No browser/GUI acceptance verification (prohibited by this round's scope)
- No dev server start (prohibited by this round's scope)
- Open Library search.json and works/{id}.json response shapes are modeled from
  public documentation, but actual field names were verified against community
  knowledge — no real API was called to validate

## 13. Project total progress

**88.50%** (adjusted from 88.00%, +0.50%)

Reason: Open Library dev-only provider adapter + import page preview entry
represent the first concrete external book source provider. 47 new tests,
0 regressions, lint 0 errors. All disabled-by-default with 4-layer guard
protection.

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
- No real provider integration beyond dev-only adapter

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
- OE-specific fields (ebook_count_i, publisher, isbn, subject) are NOT exposed in normalized output
