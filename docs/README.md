# learning-agent-platform 文档入口

Codex 每轮默认入口已经收敛到：

- `docs/codex-context/`

除非任务明确要求审计、阶段总结、参考分析或全局规划，否则不要全量读取 `docs/`。

## 默认阅读

每轮默认先读：

1. `AGENTS.md`
2. `docs/codex-context/CODEX_ALWAYS_READ.md`
3. `docs/codex-context/CODEX_RULES.md`
4. `docs/codex-context/CURRENT_HANDOFF.md`
5. `docs/codex-context/SAFETY_BOUNDARIES.md`
6. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
7. `docs/codex-context/DOC_WORKFLOW.md`

按任务再追加少量相关文档和源码。

## 默认不读

- 不默认读取所有历史 Axxx 文档。
- 不默认读取 `docs/status/PROJECT_COMPLETION_SUMMARY.md`。
- 不默认读取 `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md`。
- 不默认读取 `docs/reference-analysis`。
- 不默认读取外部参考项目源码。

## 长文档用途

- `docs/status/PROJECT_COMPLETION_SUMMARY.md`：长期项目完成度汇总，主要给 DeepSeek 阶段压缩读取。
- `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md`：真实产品完成度审计，需要审计时再读。
- `docs/reference-analysis/`：只保留参考项目分析结果，默认不参与每轮 Codex 上下文。
- `docs/rounds/codex/`：Codex 每轮总结。
- `docs/rounds/deepseek/`：DeepSeek 阶段压缩输出。
- `docs/_archive_pending_review/`：不删除旧文档，先放入待人工复核区。

## 当前主线优先级

1. Web 编程学习 MVP 打磨。
2. Desktop / 软件端 Agent MVP。
3. 三层记忆压缩系统。
4. 后台工具调用系统。
5. Skill 社区暂缓。

不要把 preview、mock、scaffold 或 disabled-by-default 能力说成真实生产能力。
