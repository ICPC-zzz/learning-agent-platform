# Legacy Modules

Generated: 2026-06-26 (A500)
Purpose: Document modules that are no longer part of the active product direction

## Legacy Module List

### 1. Books / Book Library
- **Status**: Legacy — not in current product direction
- **Why deprecated**: Product pivoted from "Books/Reader as primary entry" to "Articles + Codeforces + Personal + AI Assistant" four-module structure
- **Source code**: Retained in `apps/web/src/app/books/`, `apps/web/src/app/reader/`, `packages/book-engine/`
- **When safe to delete source**: After all reader-sync infrastructure and book data migration needs are resolved
- **Forbidden**: Do NOT restore Books as primary navigation entry, do NOT add new book import features

### 2. Reader (Reading Interface)
- **Status**: Legacy — not in current product direction
- **Why deprecated**: Full Reader experience (bookmarks, notes, reading progress, chapter Q&A, sync) was primary in A310-A393 era. Current direction uses Articles and Problem pages for learning content, not book reading.
- **Source code**: Retained in `apps/web/src/app/reader/` (extensive reader-sync infrastructure), `packages/book-engine/`
- **When safe to delete source**: After confirming no data migration or recovery depends on these files
- **Key retained docs**: `docs/modules/reader-sync-current-state.md` (referenced by CODEX_ALWAYS_READ for Reader sync tasks)

### 3. Text Import Flow
- **Status**: Legacy — not in current product direction
- **Why deprecated**: Text import was designed to feed books into the Reader. Without Reader as primary entry, import flow has no user-facing purpose.
- **Source code**: Retained in `apps/web/src/app/import/`
- **When safe to delete source**: After confirming import-related Prisma models (`Book`, chapter data) are not needed for migration

### 4. Self-Hosted OJ (Online Judge)
- **Status**: Legacy — explicitly excluded from current product
- **Why deprecated**: High cost, compliance risk, does not directly improve the learning loop. Product direction explicitly states: "No self-hosted OJ, no Docker judge, no full problem statement sync."
- **Source code**: Any OJ/judge related code in packages or apps
- **When safe to delete source**: After confirming no infrastructure depends on judge-related types

### 5. Docker Judge
- **Status**: Legacy — explicitly excluded
- **Why deprecated**: See OJ above. Docker-based code execution carries security and compliance risks.
- **Source code**: Any Docker/judge configuration or runner code
- **Forbidden**: Do NOT restore Docker judge containers, runner infrastructure, or submission execution

### 6. VJudge Full Statement Import
- **Status**: Legacy — explicitly excluded
- **Why deprecated**: Product direction limits problem data to minimal metadata (name, rating, tags, contestId, index, link). Full statement scraping was planned but never completed.
- **Source code**: May have partial scaffolding only
- **Forbidden**: Do NOT implement statement scraping or import

### 7. Multi-OJ Expansion
- **Status**: Legacy — explicitly excluded
- **Why deprecated**: Product direction states only Codeforces is used. Multi-OJ would dilute focus without improving the learning loop.
- **Source code**: None active
- **Forbidden**: Do NOT add support for additional online judges

### 8. Skill Store / Community
- **Status**: Placeholder/scaffold — not in current product direction
- **Why deprecated**: Skill store requires significant security, audit, and distribution infrastructure. Current placeholder code is kept as scaffold for future expansion.
- **Source code**: Retained as placeholder in `packages/ai-core/` (manifest types, validation, registry)
- **Forbidden**: Do NOT expand Skill store capabilities without explicit task; do NOT delete placeholder code

### 9. Unbounded Agent
- **Status**: Explicitly constrained
- **Why constrained**: Agent capabilities are limited to preview-only / mock-only / disabled-by-default. The product direction states: "All Agents, tool calls, Skills, autonomy must prioritize permissions, logging, and safety boundaries. Do not make Agent an all-powerful assistant that can execute arbitrary tools."
- **Source code**: Retained with safety guards in `packages/ai-core/`
- **Forbidden**: Do NOT remove safety guards; do NOT enable arbitrary tool execution

## Source Code Retention Rules

- All legacy source code remains in the repository
- Do NOT delete legacy source files during documentation cleanup
- Legacy source may be referenced by still-active tests, type exports, or infrastructure
- Future rounds may explicitly authorize source deletion once data dependencies are resolved

## Recovery Protection

- The following capabilities must NOT be auto-restored by any future AI agent without explicit user authorization:
  - Books/Reader as primary navigation entry
  - Self-hosted OJ or Docker judge
  - VJudge statement import
  - Multi-OJ expansion
  - Full problem statement display
  - Unbounded Agent execution
  - Skill store expansion
