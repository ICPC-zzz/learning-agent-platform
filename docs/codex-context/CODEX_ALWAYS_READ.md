# Codex Always Read

本目录是 Codex 每轮优先读取的小上下文目录，用来替代反复读取大量历史文档。

## 默认读取

每轮 Codex 默认先读 `docs/codex-context` 下的小上下文文档，尤其是：

- `CODEX_ALWAYS_READ.md`
- `CODEX_RULES.md`
- `CURRENT_HANDOFF.md`
- `SAFETY_BOUNDARIES.md`
- `ARCHITECTURE_BOUNDARIES.md`
- `DOC_WORKFLOW.md`

## 默认不读取

- Codex 每轮只读本轮任务相关源码。
- Codex 默认不读所有历史 Axxx 文档。
- Codex 默认不读 `docs/status/PROJECT_COMPLETION_SUMMARY.md`。
- Codex 默认不读 `docs/reference-analysis`。
- 只有任务明确要求审计、阶段总结、文档压缩、全局规划或参考分析时，才读取上述大文件。

## 上下文不足时

如果上下文过长、额度不足、文档过多或无法干净完成，Codex 必须停止并提醒用户开 Axxx+ 补救对话，不要硬撑着继续扩大范围。

## 每轮收尾

每轮完成后必须：

- 写入 `docs/rounds/codex/Axxx_codex.md`。
- 更新 `docs/codex-context/CURRENT_HANDOFF.md`。
- 在总结中说明修改文件、验证命令、验证结果、风险、下一步建议和项目总进度。
