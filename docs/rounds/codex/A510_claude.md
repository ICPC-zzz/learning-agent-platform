# A510 — CCX 源码级记忆、工具与 Agent Runtime 复用分析

## 任务

源码级研究轮 — 真实阅读 E:\code\ccx 源码，结合当前项目现状，生成可指导源码搬运的详细分析报告。

## 完成内容

- 实际读取 CCX 源码约 25 个核心文件（QueryEngine, query, Tool, memdir/*, services/extractMemories/*, services/tools/*, services/compact/*, utils/toolResultStorage, utils/attachments, utils/abortController 等）
- 读取当前项目所有关键源码（memory/*, tools/*, agent-runtime/*, assistant/*, db/*, prisma schema）
- 生成两份输出:
  1. `docs/reference-analysis/CCX_SOURCE_LEVEL_MEMORY_TOOLS_AGENT_ANALYSIS.md` (~560 行, 32 节)
  2. `docs/reference-analysis/CCX_SOURCE_PORTING_MATRIX.md` (精简矩阵)

## 关键发现

### 迁移分类统计
- DIRECT_REUSE: 2 (abortController 模式, memory 类型模板)
- ADAPT_AND_REUSE: 8 (extractMemories cursor, partitionToolCalls, 错误映射, toolResultStorage, circuit breaker 等)
- REIMPLEMENT_FROM_DESIGN: 1 (StreamingToolExecutor — Anthropic SDK 耦合)
- ALREADY_IMPLEMENTED: 2+ (Memory 类型/契约/存储/压缩, Tool 执行器/权限, 多 Agent 任务)
- SKIP: 文件型记忆目录, BashTool, MCP 生态, Ink/CLI, team memory, KAIROS
- NEEDS_MORE_RESEARCH: utils/task/framework.ts 等 5 项

### 旧分析修正
- "queryLoop 显式函数" → query 递归循环, 无 queryLoop 函数名
- "tools.ts/toolPool.ts" → Tool.ts 简单字典
- "KAIROS 自动蒸馏" → gated behind feature('KAIROS')

### 核心方案
1. MemoryItem 外键方案: userId 改为 plain string (仿 ArticleFavorite 模式)
2. 双层记忆机制: 第一层即时写入 + 第二层后台归纳（cursor + 去重 + superseded/archived）
3. 工具系统合并: 废弃 agent-runtime 和 Web 层重复 Registry，以 InMemoryToolRegistry 为基础增强
4. 可靠 Tool Loop: every tool_use generates structured tool_result, 强制回灌
5. 悬浮助手: 保留为快捷入口，/ai 为完整功能入口

## 后续实施顺序

| 轮次 | 任务 |
|------|------|
| 1 | 修复 MemoryItem FK + 增强去重 |
| 2 | 合并工具 Registry + 增强执行器 (并发分区+错误映射) |
| 3 | 后台记忆归纳 (cursor+去重+替换) |
| 4 | 执行链 UI 完善 |
| 5 | 悬浮助手整合 |

## 未修改
- apps, packages, Prisma, CCX 源码
- 未执行 git 操作

## 风险
- MemoryItem FK 改动 → 用 migration 非破坏性
- Registry 合并 → 旧 Registry 作为 adapter 过渡
- 未确认的 CCX 能力 (task framework 等) → 后续读取确认
