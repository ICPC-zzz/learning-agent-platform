# Document Index

Generated: 2026-06-26 (A500)
Purpose: Entry-point index for future development rounds. Only lists documents that are currently valid and exist.

## New Round Executor Must Read

Every new round, the executor must read these files first:

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 1 | Current Handoff | `docs/codex-context/CURRENT_HANDOFF.md` | Current state, last round results, next task |
| 2 | Codex Always Read | `docs/codex-context/CODEX_ALWAYS_READ.md` | Default read rules |
| 3 | Codex Rules | `docs/codex-context/CODEX_RULES.md` | Codex behavior and modification rules |
| 4 | Safety Boundaries | `docs/codex-context/SAFETY_BOUNDARIES.md` | Agent/Tool/LLM safety boundaries |
| 5 | Architecture Boundaries | `docs/codex-context/ARCHITECTURE_BOUNDARIES.md` | Module responsibilities and boundaries |
| 6 | Doc Workflow | `docs/codex-context/DOC_WORKFLOW.md` | Document workflow and compression rules |
| 7 | Product Direction | `docs/product/AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md` | Sole authoritative product direction |
| 8 | Project Completion Summary | `docs/status/PROJECT_COMPLETION_SUMMARY.md` | Long-term completion status and progress |
| 9 | Last Round Summary | `docs/rounds/codex/A499_codex.md` | Most recent round completion summary |

## Product Documents

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 10 | Product Direction | `docs/product/AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md` | Four-module product definition |
| 11 | Legacy Modules | `docs/status/LEGACY_MODULES.md` | What is legacy and why |

## Architecture Documents

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 12 | System Architecture | `docs/architecture/SYSTEM_ARCHITECTURE.md` | Module architecture and boundaries |
| 13 | Architecture Boundaries | `docs/codex-context/ARCHITECTURE_BOUNDARIES.md` | Module responsibilities and boundary rules |
| 14 | Safety Boundaries | `docs/codex-context/SAFETY_BOUNDARIES.md` | Agent/Tool/LLM safety rules |

## Operations & Verification

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 15 | Third-Party API Env | `docs/setup/THIRD_PARTY_API_ENV.md` | API environment variable setup |
| 16 | DB Dev Setup | `docs/database/PROBLEM_USER_DATA_DB_DEV_SETUP.md` | Database deployment reference |
| 17 | Document Inventory | `docs/status/DOCUMENT_INVENTORY.md` | Current document inventory |
| 18 | Cleanup Manifest | `docs/status/A500_DOCUMENT_CLEANUP_MANIFEST.md` | A500 cleanup decisions |

## Stage History & Compression

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 19 | A394–A499 Stage Summary | `docs/status/A394-A499_STAGE_SUMMARY.md` | Compressed stage history |
| 20 | A499 Codex Summary | `docs/rounds/codex/A499_codex.md` | A499 recovery details |
| 21 | A499 DeepSeek Handoff | `docs/rounds/deepseek/A499_deepseek.md` | A499 DeepSeek analysis |
| 22 | A498+ Codex Summary | `docs/rounds/codex/A498_codex.md` | A498 product scope calibration |
| 23 | A497 Codex Summary | `docs/rounds/codex/A497_codex.md` | A497 typecheck verification |
| 24 | A496 Codex Summary | `docs/rounds/codex/A496_codex.md` | A496 typecheck repair |
| 25 | A495 Codex Summary | `docs/rounds/codex/A495_codex.md` | A495 file corruption recovery |
| 26 | A492 Claude Summary | `docs/rounds/codex/A492_claude.md` | Multi-agent code analysis design |

## Module-Specific Documents

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 27 | Reader Sync Current State | `docs/modules/reader-sync-current-state.md` | Reader sync module summary (legacy context) |

## Reference Analysis (External)

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 28 | CCX Analysis | `docs/reference-analysis/CCX_MEMORY_AND_TOOLS_ANALYSIS.md` | External CCX reference |
| 29 | Harness Analysis | `docs/reference-analysis/HARNESS_ANALYSIS.md` | External Harness reference |

## Documents No Longer Valid

The following documents were removed in A500 cleanup. Do NOT reference them:

- `docs/product/PRODUCT_SPEC.md` — Superseded by AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md
- `docs/product/WEB_REAL_BUSINESS_ROADMAP.md` — Based on old books/Reader/OJ scope
- `docs/product/USER_CENTER_AND_FAVORITES_SPEC.md` — Based on old product model
- `docs/codex-tasks/DEVELOPMENT_ROADMAP.md` — Superseded
- `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md` — A128-era audit, absorbed into stage summary
- `docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md` — Absorbed into A394-A499_STAGE_SUMMARY.md
- `docs/status/archive_report.md` — Absorbed into A394-A499_STAGE_SUMMARY.md
- `docs/status/compression.md` — Absorbed into A394-A499_STAGE_SUMMARY.md
- `docs/status/A412_BROWSER_ACCEPTANCE_REPORT.md` — Minimal content, already absorbed
- All A394–A404 round documents — Compressed into A394-A499_STAGE_SUMMARY.md
- All A487–A494 round documents — Compressed into A394-A499_STAGE_SUMMARY.md
- All DeepSeek compression/archive reports (A334–A486) — Consolidated
- All reader-sync design docs — Summarized in LEGACY_MODULES.md
- All root *.log files — Dev logs, not reference material
- .codex_tmp typecheck/log files — Temporary diagnostics

See `docs/status/A500_DOCUMENT_CLEANUP_MANIFEST.md` for the full deletion list and backup location.
