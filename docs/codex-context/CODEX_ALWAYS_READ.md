# Codex Always Read

本目录是 Codex 每轮优先读取的小上下文目录，用来替代反复读取大量历史文档。

## 默认读取

每轮 Codex 默认先读 `docs/codex-context` 下的小上下文文档：

- `CODEX_ALWAYS_READ.md`
- `CODEX_RULES.md`
- `CURRENT_HANDOFF.md`
- `SAFETY_BOUNDARIES.md`
- `ARCHITECTURE_BOUNDARIES.md`
- `DOC_WORKFLOW.md`
- 最近 1 轮 `docs/rounds/codex/A4xx_claude.md`（当前轮 summary）

**Reader sync 任务额外必读：**
- `docs/modules/reader-sync-current-state.md` — Reader sync 模块级总结，替代历史 A310–A332 轮次文档

**需要了解 Web 真实能力接入阶段（A394–A403）时读：**
- `docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md` — A394–A403 跨轮压缩总结（**不要**默认读各原始轮次）

## 默认不读取

- 所有历史 A394–A403 原始轮次文档（`docs/rounds/codex/A394_claude.md` ～ `A403_claude.md`）— 已被压缩文档替代
- 所有 `docs/rounds/deepseek/` 下的 DeepSeek 交接文档
- `docs/_archive_pending_review/` 全部内容
- `docs/status/PROJECT_COMPLETION_SUMMARY.md`（仅审计/阶段总结/全局规划时读）
- `docs/reference-analysis/`（仅明确要求参考分析时读）
- 旧草案文档（`docs/reader-*-design.md`、`docs/reader-*-audit.md` 等）

## 上下文不足时

如果上下文过长、额度不足、文档过多或无法干净完成，Codex 必须停止并提醒用户开 Axxx+ 补救对话，不要硬撑着继续扩大范围。

## 每轮收尾

每轮完成后必须：

- 写入 `docs/rounds/codex/Axxx_claude.md`。
- 更新 `docs/code