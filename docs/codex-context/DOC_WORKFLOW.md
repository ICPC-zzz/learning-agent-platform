# Doc Workflow

本项目采用 Codex + DeepSeek + ChatGPT 三段式文档工作流，避免 Codex 每轮读取大量历史文档。

## 三段式流程

1. Codex 每轮完成后输出 `docs/rounds/codex/Axxx_codex.md`。
2. Codex 每轮完成后更新 `docs/codex-context/CURRENT_HANDOFF.md`。
3. DeepSeek 读取 `docs/status/PROJECT_COMPLETION_SUMMARY.md` 和最新 `docs/rounds/codex/Axxx_codex.md`。
4. DeepSeek 输出 `docs/rounds/deepseek/Axxx_deepseek.md`。
5. ChatGPT 根据 `Axxx_deepseek.md` 生成下一轮 Codex 提示词。

## 阶段压缩

当 `docs/rounds/codex/Axxx_codex.md` 累计较多时，由 DeepSeek 执行阶段压缩，把多轮进度压缩进：

- `docs/status/PROJECT_COMPLETION_SUMMARY.md`

Codex 默认不读大量历史文档，避免上下文窗口爆炸。

## 进度口径

当用户明确调整项目主线范围时，必须在 `docs/status/PROJECT_COMPLETION_SUMMARY.md` 和最新 `CURRENT_HANDOFF.md` 同步说明旧口径、新口径和新项目总进度。

从 A143 起，近期主线进度按 Web 网页端 + 软件端/Desktop 计算；Skill 社区仅保留占位/scaffold，不作为近期完成度分母。后续如果 Skill 社区重新纳入产品目标，必须重新校准进度条。

## 文档归档

不需要的文档不删除，只移动到：

- `docs/_archive_pending_review/`

该目录等待用户人工复核和删除。移动文件时优先使用 `git mv`；未被 Git 跟踪的文档可使用 PowerShell `Move-Item`。
