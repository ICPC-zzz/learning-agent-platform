# Document Inventory — A500 Cleanup Baseline

Generated: 2026-06-26
Purpose: Pre-cleanup inventory of all docs, logs, and temporary files

## Summary Statistics

| Category | Count | Size |
|----------|-------|------|
| Docs total files | 97 | ~1.37 MB |
| Docs Markdown (.md) | 92 | ~1.36 MB |
| Docs non-Markdown | 5 | ~10 KB (4 pngs + 1 .gitkeep) |
| Round documents (codex) | 26 | ~260 KB (22 .md + 4 .png) |
| Round documents (deepseek) | 27 | ~180 KB (26 .md + 1 .gitkeep) |
| Status summaries | 6 | ~120 KB |
| Product design docs | 4 | ~52 KB |
| .codex_tmp files | 157 | ~6.83 MB |
| Root log files | 57 | ~636 KB |
| Total pre-cleanup | 311+ | ~8.84 MB |

## Detailed Breakdown

### docs/rounds/codex/ (26 files)

Files (22 .md + 4 .png):
- A333_codex.md, A333_docs_claude.md, A333_docs_cleanup_claude.md
- A394_claude.md through A404_claude.md (11 files: A394-A404)
- A487_claude.md through A490_claude.md, A492_claude.md (5 files)
- A493_codex.md, A494_claude.md, A495_codex.md, A496_codex.md, A497_codex.md, A498_codex.md, A499_codex.md (7 files)
- A219_desktop_agent.png, A219_desktop_home.png, A219_desktop_reader.png, A242_learning_weekly_report.png (4 screenshots)

### docs/rounds/deepseek/ (27 files)

Files (26 .md + 1 .gitkeep):
- A333_deepseek.md
- Compression/archive reports: A334-A393, A394-A403, A404-A455, A456-A476, A477-A486 (10 files)
- A394_deepseek.md through A403_deepseek.md (10 files)
- A487_deepseek.md, A488_deepseek.md, A489_deepseek.md
- A493_deepseek.md through A499_deepseek.md (7 files)
- .gitkeep

### docs/status/ (6 files)
- PROJECT_COMPLETION_SUMMARY.md (23.5 KB)
- REAL_PRODUCT_COMPLETION_AUDIT.md (78.3 KB)
- A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md (6.4 KB)
- A412_BROWSER_ACCEPTANCE_REPORT.md (1.0 KB)
- archive_report.md (9.6 KB)
- compression.md (9.3 KB)

### docs/product/ (4 files)
- AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md (8.7 KB)
- PRODUCT_SPEC.md
- WEB_REAL_BUSINESS_ROADMAP.md
- USER_CENTER_AND_FAVORITES_SPEC.md

### docs/codex-context/ (6 files)
- CODEX_ALWAYS_READ.md, CODEX_RULES.md, CURRENT_HANDOFF.md
- SAFETY_BOUNDARIES.md, ARCHITECTURE_BOUNDARIES.md, DOC_WORKFLOW.md

### Root-level docs/ (loose .md files) (6 files)
- reader-sync-contract-design.md
- reader-sync-server-action-design.md
- reader-noop-server-action-design.md
- reader-sync-repository-alignment-audit.md
- reader-db-sync-verification.md
- desktop-home-reader-card-acceptance.md
- desktop-web-loader.md

### docs/modules/ (2 files)
- reader-sync-current-state.md
- reader-sync-archive-index.md

### Other docs/ directories
- architecture/: SYSTEM_ARCHITECTURE.md (1 file)
- database/: PROBLEM_USER_DATA_DB_DEV_SETUP.md (1 file)
- setup/: THIRD_PARTY_API_ENV.md (1 file)
- reference-analysis/: CCX_MEMORY_AND_TOOLS_ANALYSIS.md, HARNESS_ANALYSIS.md (2 files)
- codex-tasks/: DEVELOPMENT_ROADMAP.md (1 file)
- _archive_pending_review/: 3 files (A404 cleanup archive)
- docs/README.md

### .codex_tmp/ (157 files, ~6.83 MB)
- A493 typecheck iteration logs: ~38 files (~3.5 MB)
- A495 recovery scan/restore logs: ~17 files (~0.2 MB)
- A496 typecheck logs: ~14 files (~0.3 MB)
- A497 typecheck logs: ~8 files (~0.1 MB)
- Remaining: ~80 files from A492, A498, A499 typecheck/browser logs

### Root log files (57 files, ~636 KB)
- A218/A248/A260 desktop/web dev logs
- a479 web dev logs
- dev-web* logs (various ports)
- tmp-dev-web* logs
- scenario1-5 test logs
- vm-lint-debug.log
- .codex-dev-web.*.log
- .tmp-vjudge-test.*.log

## Legacy Content Assessment

Documents mentioning legacy product direction (books/Reader as primary/OJ/Docker judge/VJudge):
- 26 Markdown files in docs/ contain legacy keywords
- Most prominent: PROJECT_COMPLETION_SUMMARY.md (old 83% based on books+Reader+OJ)
- WEB_REAL_BUSINESS_ROADMAP.md, SYSTEM_ARCHITECTURE.md, PRODUCT_SPEC.md, USER_CENTER_AND_FAVORITES_SPEC.md
- Multiple A394-A404 round documents and compression summaries
- Several reader-sync-* root docs

## Duplicate/Redundant Content

- A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md duplicates content now in A394-A403_compression.md (deepseek)
- archive_report.md and compression.md in status/ appear to be intermediate drafts
- A333_docs_claude.md and A333_docs_cleanup_claude.md likely contain duplicate A333 content with A333_codex.md
- Round compression reports (A334-A393, A394-A403, A404-A455, A456-A476, A477-A486) overlap with individual round docs still present
- REAL_PRODUCT_COMPLETION_AUDIT.md (78 KB) is largest file — needs assessment against new product direction

## Expired/Orphan Documents

- Reader sync design docs (6 root-level .md files) — Reader is now legacy, these detail a subsystem not in current product direction
- desktop-home-reader-card-acceptance.md, desktop-web-loader.md — Desktop only has read-only panels now
- WEB_REAL_BUSINESS_ROADMAP.md — based on old books/OJ product direction
- USER_CENTER_AND_FAVORITES_SPEC.md — based on old user model with books+Reader
- A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md — superseded by newer compression
- A412_BROWSER_ACCEPTANCE_REPORT.md — minimal content (1 KB), already absorbed
- codex-tasks/DEVELOPMENT_ROADMAP.md — superseded by product direction doc
- A219/A242 screenshots (4 .png files) — legacy Desktop screenshots
- archive_report.md (status/) — intermediate draft
- compression.md (status/) — intermediate draft
