# learning-agent-platform 文档入口

本文档是后续 Codex 会话进入项目文档的默认入口。除非任务明确需要追溯历史，否则不要全量读取 `docs/`。

## 1. 当前主线阅读顺序

未来每轮 Codex 默认优先读取：

1. `AGENTS.md`
2. `docs/product/PRODUCT_SPEC.md`
3. `docs/architecture/SYSTEM_ARCHITECTURE.md`
4. `docs/codex-tasks/CODEX_RULES.md`
5. `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
6. `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md`（待 A128 完成）
7. `docs/reference-analysis/HARNESS_ANALYSIS.md`
8. `docs/reference-analysis/CCX_MEMORY_AND_TOOLS_ANALYSIS.md`

按任务再追加少量相关文档。不要因为想“全面了解”而递归读取整个 `docs/`。

## 2. 当前主线优先级

1. Web 编程学习 MVP 打磨
2. Desktop / 软件端 Agent MVP
3. 三层记忆压缩系统
4. 后台工具调用系统
5. Skill 社区暂缓

Skill 社区仍是长期方向，但当前不应作为主线优先级推进。

## 3. 默认不要读取的目录

`docs/archive/` 默认不要在每轮读取。

只有需要追溯历史阶段、旧设计、旧决策、阶段总结、过期规划或路径迁移原因时，才按需读取 archive 中的索引和少量原文。

`docs/reference-analysis/harness/` 和 `docs/reference-analysis/ccx/` 是核心参考分析的来源材料，默认也不逐篇读取。一般先读两份总分析：

- `docs/reference-analysis/HARNESS_ANALYSIS.md`
- `docs/reference-analysis/CCX_MEMORY_AND_TOOLS_ANALYSIS.md`

## 4. 归档目录说明

`docs/archive/` 不是删除区，而是历史文档压缩区。

归档的目的：

- 保留旧阶段信息和决策痕迹。
- 降低未来 Codex 每轮读取旧文档造成的上下文污染。
- 防止把历史阶段完成度误判为当前产品完成度。
- 让主线目录只保留当前开发必须依赖的文档。

当前归档批次索引见：

- `docs/archive/README.md`
- `docs/archive/2026-05-pre-realignment/`

## 5. 文档维护规则

- 新阶段总结放到 `docs/status/` 或对应主题目录。
- 过期局部总结、阶段 gate、临时修复记录和被新文档覆盖的旧计划应及时归档。
- 不要让 Codex 每轮读取全部 `docs/`。
- 不要把历史阶段完成度当成整体产品完成度。
- 不要把 preview、mock、scaffold 说成真实生产能力。
- 归档前优先建立索引，不永久删除重要信息。
- 如果移动了被当前文档引用的文件，需要在审计文档中记录未来修正建议。
