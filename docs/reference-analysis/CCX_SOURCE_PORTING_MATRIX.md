# CCX → LAP 源码搬运矩阵

> A510 轮 — 精简迁移决策矩阵
> 日期: 2026-06-27

## 说明

迁移分类: DIRECT_REUSE | ADAPT_AND_REUSE | REIMPLEMENT_FROM_DESIGN | ALREADY_IMPLEMENTED | REFERENCE_ONLY | SKIP | NEEDS_MORE_RESEARCH

矩阵按优先级排序。

## Memory

| CCX 文件 | 核心符号 | 目标文件 | 分类 | 修改内容 | 工作量 | 安全 | 轮次 |
|----------|---------|---------|------|---------|-------|------|------|
| memdir/memoryTypes.ts | TYPES_SECTION_INDIVIDUAL | ai-core/memory/prompts/ | DIRECT_REUSE | 中文化文本模板 | 低 | 低 | 1 |
| services/extractMemories/extractMemories.ts | hasMemoryWritesSince, cursor | apps/web/lib/assistant/memory-service.ts | ADAPT_AND_REUSE | 文件系统→DB, fork agent→background job | 中 | 低 | 3 |
| services/extractMemories/extractMemories.ts | 抽取 prompt 设计 | ai-core/memory/MemoryExtractor.ts | ADAPT_AND_REUSE | 适配 DB 存储 | 中 | 低 | 3 |
| memdir/findRelevantMemories.ts | findRelevantMemories 选择器 | ai-core/memory/MemoryRetriever.ts | ADAPT_AND_REUSE | side query→关键词+scope | 中 | 低 | 3 |
| services/compact/autoCompact.ts | circuit breaker (MAX_FAILURES=3) | ai-core/memory/a505-context-compression.ts | ADAPT_AND_REUSE | 适配 A505 | 低 | 低 | 4 |
| services/compact/microCompact.ts | 清理旧 tool result | ai-core/memory/ | ADAPT_AND_REUSE | 适配 Web | 低 | 低 | 4 |
| memdir/memdir.ts | buildMemoryPrompt, MEMORY.md | — | SKIP | — | — | — | — |
| memdir/memoryScan.ts | scanMemoryFiles | — | SKIP | DB 替代 | — | — | — |

## Tools

| CCX 文件 | 核心符号 | 目标文件 | 分类 | 修改内容 | 工作量 | 安全 | 轮次 |
|----------|---------|---------|------|---------|-------|------|------|
| services/tools/toolOrchestration.ts | partitionToolCalls | agent-runtime/tools/tool-executor.ts | ADAPT_AND_REUSE | 适配 ToolDefinition | 中 | 低 | 2 |
| services/tools/toolExecution.ts | runToolUse 错误分类 | agent-runtime/tools/tool-executor.ts | ADAPT_AND_REUSE | 中文化, 适配类型 | 低 | 低 | 2 |
| utils/toolResultStorage.ts | 持久化阈值+预览算法 | 新建 LargeToolResultStore | ADAPT_AND_REUSE | 文件→DB/S3 | 低 | 低 | 2 |
| utils/abortController.ts | createChildAbortController | agent-runtime/tools/tool-executor.ts | DIRECT_REUSE | 无 | 低 | 低 | 2 |
| services/tools/StreamingToolExecutor.ts | 队列+并发控制 | — | REIMPLEMENT | Anthropic SDK 耦合 | — | — | — |

## Agent/Task

| CCX 文件 | 核心符号 | 目标文件 | 分类 | 修改内容 | 工作量 | 安全 | 轮次 |
|----------|---------|---------|------|---------|-------|------|------|
| utils/task/framework.ts | task 注册/清理 | — | NEEDS_MORE_RESEARCH | 待读取 | — | — | — |
| tools/TaskCreateTool/ | 任务创建 | — | SKIP | 已有对应 | — | — | — |
| QueryEngine.ts | submitMessage | — | ALREADY_IMPLEMENTED | — | — | — | — |
| query.ts | query 递归 | — | ALREADY_IMPLEMENTED | — | — | — | — |

## 统计

| 分类 | 数量 |
|------|------|
| DIRECT_REUSE | 2 |
| ADAPT_AND_REUSE | 8 |
| REIMPLEMENT_FROM_DESIGN | 1 |
| ALREADY_IMPLEMENTED | 2 |
| SKIP | 2 |
| NEEDS_MORE_RESEARCH | 1 |

## 推荐搬运顺序

1. **第一轮:** DIRECT_REUSE 项 (无风险, 直接复制)
2. **第二轮:** Tool 相关 ADAPT_AND_REUSE (4项, 解决 Tool 失败问题)
3. **第三轮:** Memory 相关 ADAPT_AND_REUSE (3项, 解决后台归纳)
4. **第四轮:** 补充项 (circuit breaker, microcompact)
