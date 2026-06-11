# A404 — 维护提交轮：代码提交 + 文档治理 + 后续阅读入口规范化

**Model**: Claude Sonnet (Claude Code)
**Mode**: 维护/提交轮（非功能开发轮）
**Date**: 2026-06-11

## 1. 本轮性质

A404 是**维护提交轮**，不做新业务功能开发。目标：收口 A399–A403 累积的代码和文档，完成 checkpoint 提交。

## 2. 业务代码修改

本轮修改 2 个业务文件（极小格式修复，非功能变更）：

- `apps/web/src/app/import/page.tsx` — 修复文件截断（缺失 `</section>`、`</main>`、`)`、`}` 关闭标签），无功能变更
- `apps/web/src/app/user/wrong-book/page.tsx` — 修复文件截断（缺失 `</main>`、`)`、`}` 关闭标签）+ 中文引号语法错误（JSX 内未转义引号），无功能变更

## 3. 文档治理

### 新增
- `docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md` — A394–A403 跨轮压缩总结
- `docs/rounds/codex/A404_claude.md` — 本文件

### 更新
- `docs/codex-context/CURRENT_HANDOFF.md` — 标记 A403 为最新确认完成轮，A404 为维护提交轮，进度维持 88.50%，下一轮 A405
- `docs/codex-context/CODEX_ALWAYS_READ.md` — 新增压缩文档阅读指引，明确不默认读 A394–A403 原始轮次

### 归档
- `docs/rounds/codex/A404_claude.md` → `docs/_archive_pending_review/docs-cleanup/A404/A404_claude_LLM_WIP.md`
- `docs/rounds/deepseek/A404_deepseek.md` → `docs/_archive_pending_review/docs-cleanup/A404/A404_deepseek_LLM_WIP.md`
- 归档原因：旧 A404 文档描述 Reader QA External LLM 草稿工作，该功能未正式确认完成，计划 A405 正式推进。归档保留作为 WIP 上下文参考。

### 归档报告
- `docs/_archive_pending_review/docs-cleanup/A404/_archive_report.md`

## 4. 验证结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| pnpm lint (vm-lint.sh) | 0 errors | 15 个 TSX 文件语法检查全部通过 |
| typecheck (tsc --noEmit) | 预存错误 | 仅 `agent-permission-decision-preview-panel.tsx` 有预存 VM 环境 JSX 类型错误，非 A399–A404 引入 |
| book-engine tests | 91 pass / 0 fail | 含 A402/A403 contract + provider 测试 |
| daily-challenge tests | 4 suites pass / 0 fail | 含 A399–A401 daily challenge 全链路 |
| import tests | 68 pass / 0 fail | 含 A403 import 预览相关测试 |
| db repositories tests | 15 pass / 1 fail | 1 个预存失败（reader-annotation-repository：Prisma Client 未生成，VM 环境预期行为） |

## 5. Git 操作

- 提交所有修改和未跟踪文件（含目录上 A404 LLM WIP 草稿代码）
- Commit message: `chore: checkpoint web real capability integration`
- 提交包含 A404 LLM 草稿代码（`reader-qa-provider-selection.ts` 等），作为 WIP checkpoint，**不代表该功能已完成验收**

## 6. 项目进度

**维持 88.50%**（维护轮不涨进度）

## 7. 下一轮建议

**A405：Reader QA External LLM dev-only guarded path v1**
基于目录上已有 WIP 草稿正式推进：5 层 guard + fake fetch 测试全覆盖 + provider selection 模块 + server action 集成。
