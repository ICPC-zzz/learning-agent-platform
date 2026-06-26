# A500 Document Cleanup Manifest

Generated: 2026-06-26
Scope: All deletions, compressions, and archival decisions for A500 document cleanup
Backup root: E:\code\lap-a500-doc-cleanup-backup-20260626-092953

## Summary

| Action | Count | Size (est.) |
|--------|-------|-------------|
| KEEP | ~45 | ~400 KB |
| COMPRESS_THEN_DELETE | ~35 | ~300 KB |
| DELETE (docs) | ~10 | ~20 KB |
| DELETE (logs) | ~210 | ~7.5 MB |
| REVIEW | ~25 | ~450 KB |

---

## A. KEEP — Must Retain

### A1. Product Direction (1 file)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 1 | docs/product/AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md | md | 8.7 KB | Sole authoritative product direction |

### A2. Codex Context (6 files)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 2 | docs/codex-context/CURRENT_HANDOFF.md | md | 4.1 KB | Current handoff state |
| 3 | docs/codex-context/CODEX_ALWAYS_READ.md | md | 1.6 KB | Codex read rules |
| 4 | docs/codex-context/CODEX_RULES.md | md | 1.9 KB | Codex behavior rules |
| 5 | docs/codex-context/SAFETY_BOUNDARIES.md | md | 1.9 KB | Safety boundaries |
| 6 | docs/codex-context/ARCHITECTURE_BOUNDARIES.md | md | 2.2 KB | Architecture boundaries |
| 7 | docs/codex-context/DOC_WORKFLOW.md | md | 1.7 KB | Document workflow |

### A3. Status & Index Files (5 files, will be created/updated this round)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 8 | docs/status/PROJECT_COMPLETION_SUMMARY.md | md | 23.5 KB | Rewritten this round |
| 9 | docs/status/DOCUMENT_INVENTORY.md | md | ~4 KB | Created this round |
| 10 | docs/status/DOCUMENT_INDEX.md | md | ~3 KB | Created this round |
| 11 | docs/status/A500_DOCUMENT_CLEANUP_MANIFEST.md | md | ~20 KB | This file |
| 12 | docs/status/A394-A499_STAGE_SUMMARY.md | md | ~15 KB | Created this round |

### A4. Recent Round Documents (12 files — A495-A499 plus key context rounds)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 13 | docs/rounds/codex/A495_codex.md | md | 8.7 KB | Recent round, file recovery |
| 14 | docs/rounds/codex/A496_codex.md | md | 10.2 KB | Recent round, typecheck repair |
| 15 | docs/rounds/codex/A497_codex.md | md | 5.5 KB | Recent round |
| 16 | docs/rounds/codex/A498_codex.md | md | 6.2 KB | Recent round, product scope calibration |
| 17 | docs/rounds/codex/A499_codex.md | md | 6.3 KB | Current stable node |
| 18 | docs/rounds/deepseek/A495_deepseek.md | md | 9.7 KB | DeepSeek counterpart |
| 19 | docs/rounds/deepseek/A496_deepseek.md | md | 6.1 KB | DeepSeek counterpart |
| 20 | docs/rounds/deepseek/A497_deepseek.md | md | 6.5 KB | DeepSeek counterpart |
| 21 | docs/rounds/deepseek/A498_deepseek.md | md | 9.2 KB | DeepSeek counterpart |
| 22 | docs/rounds/deepseek/A499_deepseek.md | md | 9.4 KB | DeepSeek counterpart |
| 23 | docs/rounds/codex/A492_claude.md | md | ~15 KB | Unique multi-agent business design |
| 24 | docs/rounds/codex/A500_claude.md | md | ~20 KB | This round |

### A5. Architecture & Reference (6 files)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 25 | docs/architecture/SYSTEM_ARCHITECTURE.md | md | ~8 KB | Current module boundaries (needs update, not delete) |
| 26 | docs/database/PROBLEM_USER_DATA_DB_DEV_SETUP.md | md | ~3 KB | DB setup reference |
| 27 | docs/setup/THIRD_PARTY_API_ENV.md | md | 4.9 KB | API environment variables |
| 28 | docs/reference-analysis/CCX_MEMORY_AND_TOOLS_ANALYSIS.md | md | ~20 KB | External reference analysis |
| 29 | docs/reference-analysis/HARNESS_ANALYSIS.md | md | ~20 KB | External reference analysis |
| 30 | docs/README.md | md | ~1 KB | Docs directory readme |

### A6. Legacy Boundary Documentation (will be created this round)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 31 | docs/status/LEGACY_MODULES.md | md | ~5 KB | Created this round |

### A7. Module State Docs (1 file)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 32 | docs/modules/reader-sync-current-state.md | md | ~5 KB | Referenced by CODEX_ALWAYS_READ.md |

### A8. Misc non-doc files in docs/ (judged safe to keep)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| 33 | docs/modules/reader-sync-archive-index.md | md | ~3 KB | Module archive index |
| 34 | docs/_archive_pending_review/** (3 files) | md | ~15 KB | Already archived, leave as-is |

---

## B. COMPRESS_THEN_DELETE

These files will have key content extracted into A394-A499_STAGE_SUMMARY.md or LEGACY_MODULES.md, then be backed up and deleted.

### B1. Older Round Docs — Codex (already absorbed into stage summary)
| # | Original Path | Type | Size | Content Absorbed Into |
|---|--------------|------|------|----------------------|
| B1 | docs/rounds/codex/A333_codex.md | md | ~12 KB | Already in archive_report.md, stage summary |
| B2 | docs/rounds/codex/A333_docs_claude.md | md | ~10 KB | Same as above |
| B3 | docs/rounds/codex/A333_docs_cleanup_claude.md | md | ~8 KB | Same as above |
| B4 | docs/rounds/codex/A394_claude.md | md | ~8 KB | A394-A499_STAGE_SUMMARY.md |
| B5 | docs/rounds/codex/A395_claude.md | md | ~8 KB | A394-A499_STAGE_SUMMARY.md |
| B6 | docs/rounds/codex/A396_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B7 | docs/rounds/codex/A397_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B8 | docs/rounds/codex/A398_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B9 | docs/rounds/codex/A399_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B10 | docs/rounds/codex/A400_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B11 | docs/rounds/codex/A401_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B12 | docs/rounds/codex/A402_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B13 | docs/rounds/codex/A403_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B14 | docs/rounds/codex/A404_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B15 | docs/rounds/codex/A487_claude.md | md | ~16 KB | A394-A499_STAGE_SUMMARY.md |
| B16 | docs/rounds/codex/A488_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B17 | docs/rounds/codex/A489_claude.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B18 | docs/rounds/codex/A490_claude.md | md | ~15 KB | A394-A499_STAGE_SUMMARY.md |
| B19 | docs/rounds/codex/A493_codex.md | md | 4.0 KB | A394-A499_STAGE_SUMMARY.md |
| B20 | docs/rounds/codex/A494_claude.md | md | 9.0 KB | A394-A499_STAGE_SUMMARY.md |

### B2. Older Round Docs — DeepSeek (already absorbed)
| # | Original Path | Type | Size | Content Absorbed Into |
|---|--------------|------|------|----------------------|
| B21 | docs/rounds/deepseek/A333_deepseek.md | md | ~12 KB | Already in archive report |
| B22 | docs/rounds/deepseek/A394_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B23 | docs/rounds/deepseek/A395_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B24 | docs/rounds/deepseek/A396_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B25 | docs/rounds/deepseek/A397_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B26 | docs/rounds/deepseek/A398_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B27 | docs/rounds/deepseek/A399_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B28 | docs/rounds/deepseek/A400_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B29 | docs/rounds/deepseek/A401_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B30 | docs/rounds/deepseek/A402_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B31 | docs/rounds/deepseek/A403_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B32 | docs/rounds/deepseek/A487_deepseek.md | md | 8.6 KB | A394-A499_STAGE_SUMMARY.md |
| B33 | docs/rounds/deepseek/A488_deepseek.md | md | 12.1 KB | A394-A499_STAGE_SUMMARY.md |
| B34 | docs/rounds/deepseek/A489_deepseek.md | md | ~10 KB | A394-A499_STAGE_SUMMARY.md |
| B35 | docs/rounds/deepseek/A493_deepseek.md | md | 5.8 KB | A394-A499_STAGE_SUMMARY.md |
| B36 | docs/rounds/deepseek/A494_deepseek.md | md | 9.6 KB | A394-A499_STAGE_SUMMARY.md |

### B3. DeepSeek Compression/Archive Reports (absorbed into archive_report.md or stage summary)
| # | Original Path | Type | Size | Content Absorbed Into |
|---|--------------|------|------|----------------------|
| B37 | docs/rounds/deepseek/A334-A393_archive_report.md | md | ~8 KB | archive_report.md |
| B38 | docs/rounds/deepseek/A334-A393_compression.md | md | ~8 KB | PROJECT_COMPLETION_SUMMARY.md (old version) |
| B39 | docs/rounds/deepseek/A394-A403_archive_report.md | md | 2.9 KB | archive_report.md |
| B40 | docs/rounds/deepseek/A394-A403_compression.md | md | 18.5 KB | A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md + status compression.md |
| B41 | docs/rounds/deepseek/A404-A455_archive_report.md | md | 11.9 KB | archive_report.md |
| B42 | docs/rounds/deepseek/A404-A455_compression.md | md | 14.9 KB | archive_report.md |
| B43 | docs/rounds/deepseek/A456-A476_archive_report.md | md | 5.2 KB | archive_report.md |
| B44 | docs/rounds/deepseek/A456-A476_compression.md | md | 8.8 KB | archive_report.md |
| B45 | docs/rounds/deepseek/A477-A486_archive_report.md | md | 2.6 KB | archive_report.md |
| B46 | docs/rounds/deepseek/A477-A486_compression.md | md | 14.8 KB | archive_report.md |

### B4. Status Files (absorbed or duplicate)
| # | Original Path | Type | Size | Content Absorbed Into |
|---|--------------|------|------|----------------------|
| B47 | docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md | md | 6.4 KB | A394-A499_STAGE_SUMMARY.md |
| B48 | docs/status/archive_report.md | md | 9.6 KB | A394-A499_STAGE_SUMMARY.md (already is archival, not needed) |
| B49 | docs/status/compression.md | md | 9.3 KB | A394-A499_STAGE_SUMMARY.md (already is archival, not needed) |
| B50 | docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md | md | 78.3 KB | Key findings in A394-A499_STAGE_SUMMARY.md |
| B51 | docs/status/A412_BROWSER_ACCEPTANCE_REPORT.md | md | 1.0 KB | Already absorbed, minimal content |

### B5. Legacy Reader/Desktop Design Docs (compress into LEGACY_MODULES.md)
| # | Original Path | Type | Size | Content Absorbed Into |
|---|--------------|------|------|----------------------|
| B52 | docs/reader-sync-contract-design.md | md | ~10 KB | LEGACY_MODULES.md |
| B53 | docs/reader-sync-server-action-design.md | md | ~10 KB | LEGACY_MODULES.md |
| B54 | docs/reader-noop-server-action-design.md | md | ~10 KB | LEGACY_MODULES.md |
| B55 | docs/reader-sync-repository-alignment-audit.md | md | ~10 KB | LEGACY_MODULES.md |
| B56 | docs/reader-db-sync-verification.md | md | ~10 KB | LEGACY_MODULES.md |
| B57 | docs/desktop-home-reader-card-acceptance.md | md | ~5 KB | LEGACY_MODULES.md |
| B58 | docs/desktop-web-loader.md | md | ~5 KB | LEGACY_MODULES.md |

### B6. Legacy Product Docs (superseded by AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md)
| # | Original Path | Type | Size | Content Absorbed Into |
|---|--------------|------|------|----------------------|
| B59 | docs/product/PRODUCT_SPEC.md | md | ~15 KB | AI_NATIVE_LEARNING_PLATFORM_DIRECTION.md + LEGACY_MODULES.md |
| B60 | docs/product/WEB_REAL_BUSINESS_ROADMAP.md | md | ~12 KB | LEGACY_MODULES.md |
| B61 | docs/product/USER_CENTER_AND_FAVORITES_SPEC.md | md | ~12 KB | LEGACY_MODULES.md |
| B62 | docs/codex-tasks/DEVELOPMENT_ROADMAP.md | md | ~5 KB | LEGACY_MODULES.md |

---

## C. DELETE — No Compression Needed

### C1. Screenshots in round docs (legacy Desktop screenshots)
| # | Original Path | Type | Size | Reason |
|---|--------------|------|------|--------|
| D1 | docs/rounds/codex/A219_desktop_agent.png | png | ~50 KB | Legacy A219 Desktop screenshot, no current reference |
| D2 | docs/rounds/codex/A219_desktop_home.png | png | ~80 KB | Legacy A219 Desktop screenshot |
| D3 | docs/rounds/codex/A219_desktop_reader.png | png | ~80 KB | Legacy A219 Desktop screenshot |
| D4 | docs/rounds/codex/A242_learning_weekly_report.png | png | ~80 KB | Legacy A242 screenshot |

### C2. .codex_tmp/ — Typecheck iteration logs (all deletable, already summarized in round docs)
| # | Original Path | Type/Pattern | Count | Size | Reason |
|---|--------------|-------------|-------|------|--------|
| D5 | .codex_tmp/a493_*.log | Log | 38 | ~3.5 MB | A493 typecheck iteration logs |
| D6 | .codex_tmp/a495_*.{log,txt,json,tsv,pid} | Mixed | 17 | ~0.2 MB | A495 recovery scan/restore temp files |
| D7 | .codex_tmp/a496_*.log | Log | 14 | ~0.3 MB | A496 typecheck logs |
| D8 | .codex_tmp/a497_*.log | Log | 8 | ~0.1 MB | A497 typecheck logs |
| D9 | .codex_tmp/a498_*.{log,json,pid} | Mixed | 28 | ~0.8 MB | A498 typecheck logs |
| D10 | .codex_tmp/a498_plus_*.{log,json,pid} | Mixed | 16 | ~0.5 MB | A498+ typecheck logs |
| D11 | .codex_tmp/a499_*.{log,pid} | Log | 2 | ~0.1 MB | A499 web dev logs |
| D12 | .codex_tmp/a499_feature_recovery_inventory.md | md | ~5 KB | Temp inventory, absorbed in A499_codex.md |

### C3. .codex_tmp/ — Other temporary logs
| # | Original Path | Type | Count | Size | Reason |
|---|--------------|------|-------|------|--------|
| D13 | .codex_tmp/dev-web*.{err,out}.log | Log | 6 | ~50 KB | Dev web logs |
| D14 | .codex_tmp/web-3001*.{err,out}.log | Log | 4 | ~20 KB | Dev web logs |
| D15 | .codex_tmp/web-3002*.{err,out}.log | Log | 4 | ~20 KB | Dev web logs |
| D16 | .codex_tmp/web-dev.{err,out}.log | Log | 3 | ~30 KB | Dev web logs |

### C4. .codex_tmp/ — Empty directories
| # | Original Path | Type | Reason |
|---|--------------|------|--------|
| D17 | .codex_tmp/render-arch-docx/ | Empty dir | Empty, no content |
| D18 | .codex_tmp/render_ref/ | Empty dir | Empty, no content |
| D19 | .codex_tmp/render_target/ | Empty dir | Empty, no content |

### C5. Root log files (all are dev/runtime logs, not data)
| # | Original Path | Type | Count | Size | Reason |
|---|--------------|------|-------|------|--------|
| D20 | Root *.err.log, *.out.log | Log | 57 | ~636 KB | Dev web, desktop, scenario logs — all temporary |

---

## D. REVIEW — Do Not Delete Without Further Assessment

These files need human review before any action. They are NOT deleted in this round.

| # | Original Path | Type | Size | Review Reason |
|---|--------------|------|------|--------------|
| R1 | .codex_tmp/app-shots/ (4 .png) | png | ~300 KB | Browser verification screenshots — may be evidence |
| R2 | .codex_tmp/lap-architecture-diagram.png | png | ~100 KB | Architecture diagram — useful reference |
| R3 | .codex_tmp/fill_ai_for_science_docx.py | py | ~5 KB | User script — do not delete |
| R4 | .codex_tmp/insert_architecture_figure.py | py | ~5 KB | User script — do not delete |
| R5 | .codex_tmp/normalize_summary_headings.py | py | ~2 KB | User script — do not delete |
| R6 | .codex_tmp/update_section6_docx.py | py | ~5 KB | User script — do not delete |
| R7 | .codex_tmp/附件1_AI_for_Science应用研究项目申报书(114514).json | json | ~20 KB | User uploaded data — do not delete |
| R8 | .codex_tmp/附件1_AI_for_Science应用研究项目申报书_修改完成.docx | docx | ~50 KB | User uploaded data — do not delete |
| R9 | .codex_tmp/附件1_AI_for_Science申报书_修改说明.md | md | ~5 KB | User uploaded data — do not delete |
| R10 | .codex_tmp/附件1：参考格式.json | json | ~5 KB | User uploaded data — do not delete |
| R11 | docs/architecture/SYSTEM_ARCHITECTURE.md | md | ~8 KB | Needs update to reflect new product direction, but still valid arch boundaries |

---

## Cross-Reference Check

The following files being deleted/compressed are referenced by other files. These references will be updated:

- CODEX_ALWAYS_READ.md references `docs/modules/reader-sync-current-state.md` → KEEP (A7)
- CODEX_ALWAYS_READ.md references `docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md` → COMPRESS_THEN_DELETE, update CODEX_ALWAYS_READ to point to stage summary
- CURRENT_HANDOFF.md (various) → Rewritten this round, will not reference deleted files
