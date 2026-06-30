# CCX 源码级记忆、工具与 Agent Runtime 复用分析

> A510 轮 — 基于真实 CCX 源码阅读的详细迁移分析
> 日期：2026-06-27
> 模式：仅研究，不修改业务代码

## 1. 执行摘要

本轮基于对 `E:\code\ccx\src` 真实源码的系统阅读，结合 `E:\code\learning-agent-platform` 当前实现状态，生成一份可直接指导后续源码搬运和业务修复的详细报告。

**核心发现：**

1. CCX 的记忆系统是文件型 — `MEMORY.md` 入口索引 + topic markdown 文件 + 后台 fork agent 抽取。不直接匹配本项目的 Prisma 数据库模式，但记忆类型分类、抽取机制和相关性检索可复用设计。

2. CCX 的工具系统与 Anthropic SDK 深度耦合（`ToolUseBlock`、`ToolResultBlockParam`），但工具执行状态机、并发分区、错误映射和权限判断可搬运。

3. CCX 的压缩系统有完整的三层触发机制（microcompact → autoCompact → reactive compact），当前项目已有 A505 简化版。

4. CCX 的工具结果存储（外置大结果到 session 文件目录）可直接适配为 Web Artifact Repository。

5. 当前项目存在两套工具注册系统（`packages/ai-core/tools` 和 `packages/agent-runtime/tools`），需要合并。

**关键迁移策略：**
- 基于 CCX 设计模式，以当前项目已有代码为基础，构建适配层
- 核心算法和状态机可复用，存储层完全替换，UI 事件层适配为 React/Next.js
- 不搬运 CCX 的 Ink/CLI、BashTool、MCP 生态、文件型记忆目录和 team memory

## 2. 实际读取的 CCX 文件

本轮实际读取了以下 CCX 源码文件（共约 25 个核心文件）：

| 文件 | 用途 |
|------|------|
| `src/QueryEngine.ts` | 会话入口，submitMessage + query 调用链 |
| `src/query.ts` | 模型主循环，压缩/工具/记忆/附件组合 |
| `src/Tool.ts` | Tool 类型定义、ToolUseContext、ToolProgress、ToolResult |
| `src/memdir/memdir.ts` | 记忆提示词构建、MEMORY.md 入口处理 |
| `src/memdir/memoryTypes.ts` | 四类记忆分类、frontmatter 格式、TYPES_SECTION |
| `src/memdir/memoryScan.ts` | 记忆文件扫描、header 解析、manifest 格式化 |
| `src/memdir/findRelevantMemories.ts` | 通过 side query 选择相关记忆（最多5个） |
| `src/memdir/paths.ts` | 记忆路径解析、auto memory 启用判断 |
| `src/services/extractMemories/extractMemories.ts` | 后台记忆抽取，fork agent 模式，cursor 幂等 |
| `src/services/extractMemories/prompts.ts` | 抽取提示词 |
| `src/services/tools/toolOrchestration.ts` | runTools 主编排，并发安全分区 |
| `src/services/tools/toolExecution.ts` | runToolUse 单工具执行，schema 校验，权限，hook |
| `src/services/tools/StreamingToolExecutor.ts` | 流式工具执行，队列管理，并发控制 |
| `src/services/tools/toolHooks.ts` | PreToolUse/PostToolUse hook 管线 |
| `src/services/compact/compact.ts` | 主压缩流程，CompactionResult，post-compact attachments |
| `src/services/compact/autoCompact.ts` | 自动压缩阈值、连续失败熔断 |
| `src/services/compact/sessionMemoryCompact.ts` | 已有 session memory 的压缩优化 |
| `src/services/compact/microCompact.ts` | 微小压缩（清理旧 tool result） |
| `src/utils/toolResultStorage.ts` | 大工具结果外置到文件、预览生成 |
| `src/tools/TaskCreateTool/constants.ts` | 任务创建工具定义 |
| `src/tools/TaskOutputTool/constants.ts` | 任务输出读取工具定义 |
| `src/tools/BashTool/BashTool.tsx` | Bash 工具实现（CLI 耦合，不迁移） |
| `src/utils/attachments.ts` | 附件注入、相关记忆预取 |
| `src/utils/messages.ts` | 消息创建、compact boundary 处理 |
| `src/utils/abortController.ts` | 取消控制器辅助函数 |
| `src/utils/sessionStorage.ts` | transcript 写入 |
| `src/hooks/useCanUseTool.ts` | 权限决策桥接 |

## 3. CCX 总调用链

基于源码阅读确认的 CCX 主调用链：

```text
QueryEngine.submitMessage(userInput)
  → 追加 user message 到 mutableMessages
  → 写入 transcript
  → query()
    → queryLoop()
      → startRelevantMemoryPrefetch()          // 不阻塞，并行运行
      → getMessagesAfterCompactBoundary()
      → applyToolResultBudget()                // 大结果替换为引用
      → microcompact()                          // 先清理低价值大块
      → autoCompactIfNeeded()                   // token 阈值触发
      → prependUserContext()                    // MEMORY.md + user context
      → appendSystemContext()                   // git status 等
      → call model with tools
      → collect assistant messages (流式)
      → StreamingToolExecutor / runTools()
        → partitionToolCalls(concurrencySafe?)
        → runToolsConcurrently / runToolsSerially
          → runToolUse()
            → schema 校验 (Zod)
            → tool-specific validateInput()
            → PreToolUse hooks
            → permission decision (canUseTool)
            → tool.call()
            → toolResultStorage (大结果外置)
            → mapToolResultToToolResultBlockParam()
      → collect tool_result messages
      → collect task notifications / memory attachments
      → 递归继续如果还有 tool_use 或 continuation
    → handleStopHooks (回答结束后)
      → executeExtractMemories()               // fire-and-forget fork agent
```

**关键差异点（与旧分析对比）：**
- 旧分析认为 `query.ts` 有 `queryLoop` 显式函数，实际源码中 query 函数直接实现循环逻辑
- 旧分析提到 `tools.ts`/`toolPool.ts`，实际工具注册在 `Tool.ts` 的 `Tools` 类型和 `tools.ts` 中
## 4. 显式记忆（remember/forget）

### 4.1 CCX 真实实现

CCX 的显式记忆写入**完全依赖模型判断**，没有确定性意图识别。

**写入路径：**
1. 用户说 "记住这个" / "更新记忆" / "下次别忘了"
2. 模型通过 memory prompt 知道存在持久化 memory directory
3. 模型自主调用 Write/Edit 工具写入 topic memory 文件
4. 模型更新 `MEMORY.md` 索引（添加一行指针）

**关键文件与符号：**

| 项目 | 路径 | 符号 |
|------|------|------|
| 记忆提示词 | `src/memdir/memdir.ts` | `buildMemoryLines()`, `buildMemoryPrompt()` |
| 提示词加载 | `src/memdir/memdir.ts` | `loadMemoryPrompt()` |
| Memory 路径 | `src/memdir/paths.ts` | `getAutoMemPath()`, `isAutoMemoryEnabled()` |
| 入口点名称 | `src/memdir/memdir.ts` | `ENTRYPOINT_NAME = 'MEMORY.md'` |
| 索引截断 | `src/memdir/memdir.ts` | `truncateEntrypointContent()` |
| 记忆分类 | `src/memdir/memoryTypes.ts` | `MEMORY_TYPES = ['user','feedback','project','reference']` |
| 目录确保 | `src/memdir/memdir.ts` | `ensureMemoryDirExists()` |
| 遗忘指南 | `src/memdir/memoryTypes.ts` | `TRUSTING_RECALL_SECTION` |

**CCX memory prompt 结构：**
```text
# auto memory
You have a persistent, file-based memory system at `<memoryDir>`.
This directory already exists — write to it directly with the Write tool.

## Types of memory
user / feedback / project / reference

## What NOT to save in memory
- Code patterns, conventions — derivable from project state
- Git history, recent changes
- Anything already documented in CLAUDE.md files
- Ephemeral task details

## How to save memories (two-step process)
Step 1: write memory file with frontmatter (name, description, type)
Step 2: add pointer to MEMORY.md

## When to access memories / Before recommending from memory
```

**forget 实现：**
- 没有专用 forget 工具
- 模型被指示：用户说 "forget" → 找到并删除/修改相关记忆文件
- 通过 memory prompt 中的指导实现："If they ask you to forget something, find and remove the relevant entry."

**主 Agent 是否记录本轮已写过记忆：**
- extractMemories.ts 的 `hasMemoryWritesSince()` 函数通过检查 assistant 消息中是否包含写入 auto-memory 路径的 Write/Edit tool_use 来判断
- 如果主 Agent 本轮已写，后台抽取跳过

### 4.2 当前项目实现

**关键文件与符号：**

| 项目 | 路径 | 符号 |
|------|------|------|
| 意图解析 | `apps/web/src/lib/assistant/assistant-intent-resolver.ts` | `resolveAssistantIntent()`, `extractExplicitLongTermMemory()` |
| 显式写入 | `apps/web/src/lib/assistant/memory-service.ts` | `upsertExplicitAssistantLongTermMemory()` |
| 服务端动作 | `apps/web/src/lib/assistant/assistant-server-actions.ts` | `runAssistantAction()` — MEMORY_WRITE 分支 |
| DB 仓储 | `packages/db/src/repositories/memory-repository.ts` | `PrismaMemoryRepository.addMemory()` |
| AI 类型 | `packages/ai-core/src/memory/types.ts` | `MemoryItem`, `MemoryAddInput` |
| 记忆检查 | `apps/web/src/lib/assistant/assistant-intent-resolver.ts` | `isCodeforcesRefreshReminderMemory()` |

**当前流程（A509+）：**
1. 用户输入 → `resolveAssistantIntent()` 确定性匹配中文指示词
2. 匹配到 `MEMORY_WRITE` → 服务器动作直接调用 `upsertExplicitAssistantLongTermMemory()`
3. 不经过模型 → 直接写入 Prisma MemoryItem
4. 包含去重逻辑（Codeforces 刷新提醒模板化）

**关键差异：**
- CCX：模型判断 + 文件写入，两步过程（写文件+更新索引）
- 当前项目：确定性解析 + 数据库写入，单步原子操作

### 4.3 迁移建议

**直接搬运：** 无 — CCX 的文件型写入不适用于本项目

**适配复用：**
1. 记忆类型分类（user/feedback/project/reference）→ 适配到 Prisma MemoryItem.metadata.type
2. frontmatter 格式的 name/description/type 字段 → 适配到 MemoryItem 结构化字段
3. "两步保存"思想 → skip（本项目用数据库原子写入）

**重新实现：**
- 当前项目的确定性意图解析 + 数据库写入方案已优于 CCX 的模型判断方案
- 保留当前 `extractExplicitLongTermMemory()` 的确定性解析
- 增强去重：用户重复输入相似规则时应更新而非新增

**NOT_FOUND / 待确认：**
## 5. 后台记忆归纳（executeExtractMemories）

### 5.1 CCX 真实实现

**源码位置：** `src/services/extractMemories/extractMemories.ts`

**核心符号：**
- `initExtractMemories(canUseTool, mcpClients)` — 创建闭包，返回 `executeExtractMemories`
- `executeExtractMemories(messages, cursorUuid?)` — 主入口
- `runExtraction()` — 执行抽取
- `hasMemoryWritesSince(messages, sinceUuid)` — 检查主流程已写入
- `countModelVisibleMessagesSince()` — cursor 计数

**触发时机：** 主回答结束后（handleStopHooks → executeExtractMemories），通过 `runForkedAgent` 后台运行

**关键机制：**

| 特性 | 实现 |
|------|------|
| cursor 幂等 | `sinceUuid` 参数追踪已抽取范围 |
| 主流程跳过 | `hasMemoryWritesSince()` 检查 assistant 消息中的 auto-memory Write/Edit |
| trailing run 合并 | 已有抽取运行时新请求合并，只保留最新上下文 |
| 阻塞主回答 | 不阻塞 — fire-and-forget fork agent |
| 主Agent/Subagent 区分 | 只对主 agent 运行（检查 agentId） |
| 失败处理 | 失败只记录（logEvent），不阻塞 |
| 并发处理 | 已有抽取运行时跳过新请求 |
| 重试 | NOT_FOUND — 未观察到有限重试 |
| 熔断 | NOT_FOUND — 未观察到熔断 |

**抽取结果处理：**
- 通过 fork agent 直接写入 memory directory 文件
- 不返回结构化结果给主流程
- 使用 `buildExtractAutoOnlyPrompt()` 或 `buildExtractCombinedPrompt()` 生成抽取 prompt

**记忆去重和旧规则替换：**
- CCX memory prompt 指导模型："Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one."
- 完全依赖模型判断是否重复和如何更新
- 不支持 structured 的 superseded/archived 状态

### 5.2 当前项目状态

**关键文件：**
- `packages/ai-core/src/memory/MemoryExtractor.ts` — `extractMemoryCandidates()`, `isForgetRequest()`
- `packages/ai-core/src/memory/contracts.ts` — `MemoryClassifier`, `MemoryCandidate`
- `apps/web/src/lib/assistant/memory-service.ts` — `persistAssistantMemoryTurn()`

**当前状态：** 有类型定义和接口，但后台自动抽取未完整实现为生产流程

### 5.3 迁移建议

**适配复用（ADAPT_AND_REUSE）：**

1. **cursor 幂等机制** → 适配为 Prisma MemoryItem 的 `sourceMessageId` 字段追踪
   - CCX: `sinceUuid` 字符串指针
   - 适配: `lastExtractedMessageId` 记录在每个 session 的 metadata 中

2. **主流程跳过逻辑** → 适配为检查本轮 assistant server action 是否已写入
   - CCX: `hasMemoryWritesSince()` 检查 tool_use 中的文件路径
   - 适配: 检查本轮 `runAssistantAction` 是否执行过 MEMORY_WRITE 分支

3. **后台非阻塞 fire-and-forget** → 适配为 Next.js `after()` callback 或 background job
   - 需防并发：使用数据库锁或状态字段

4. **抽取 prompt** → 直接复用 CCX 的记忆类型分类 prompt 思想
   - 目标：生成 `MemoryCandidate[]`

**重新实现（REIMPLEMENT_FROM_DESIGN）：**

1. **记忆去重和旧规则替换** → 需要实现 structured 逻辑而非依赖模型
   - 基于 `content` 的语义相似度比较
   - `metadata.type` 相同 + `metadata.category` 相同 → 比较内容相似度
   - 相似度 > 阈值 → 更新而非新增
   - 旧记忆状态: `active → superseded → archived`

2. **trailing run 合并** → 需要实现防并发队列
   - 每个 session 最多一个活跃的抽取任务

## 6. 记忆检索与注入

### 6.1 CCX 真实实现

**检索流程：**

```text
query.ts: startRelevantMemoryPrefetch()
  → attachments.ts: startRelevantMemoryPrefetch()
    → memoryScan.ts: scanMemoryFiles(memoryDir, signal)
      → 读取 memoryDir 下所有 .md 文件 frontmatter (前30行)
      → 排除 MEMORY.md
      → 返回 MemoryHeader[]: { filename, filePath, mtimeMs, description, type }
      → 按 mtimeMs 排序，最多 200 个
    → findRelevantMemories.ts: findRelevantMemories(query, memoryDir, signal, recentTools, alreadySurfaced)
      → 过滤 alreadySurfaced（已注入过的）
      → formatMemoryManifest(memories) → 文本清单
      → sideQuery(Sonnet, system + manifest + query + recentTools)
      → 返回最多 5 个文件名
    → 读取选中的 memory 文件全文（限制行数和字节数）
    → 封装为 relevant_memories attachment
    → createAttachmentMessage()
    → filterDuplicateMemoryAttachments()
    → yield 给外层 query.ts
```

**检索注入时机：** 机会式 — 在 turn 开始时预取，但正文注入在模型流式输出和工具循环期间
- 不阻塞初始模型请求
- 并行运行

**注入数量和预算：**
- 最多 5 个 memory 文件
- 单文件内容限制行数和字节数（截断后附提示）
- 同一 session 不重复注入（by `alreadySurfaced`）
- `filterDuplicateMemoryAttachments()` 去重

**检索失败了：** 不阻塞主回答 — prefetch 以 AbortSignal 控制，超时或失败后返回空

**MEMORY.md 索引角色：**
- 作为 user context 的一部分进入系统提示（不经过 side query）
- 只包含一行一条的指针
- 被截断到 MAX_ENTRYPOINT_LINES=200 行 或 MAX_ENTRYPOINT_BYTES=25KB

### 6.2 当前项目状态

**关键文件：**
- `packages/ai-core/src/memory/MemoryRetriever.ts` — `retrieveRelevantMemories()`, `buildMemoryRetrievalText()`
- `packages/ai-core/src/memory/search.ts` — `calculateKeywordMatchScore()`, `rankMemoryResults()`
- `apps/web/src/lib/assistant/memory-service.ts` — `buildAssistantMemoryContext()`

**检索方式：** 基于关键词匹配 + scope 过滤 + 时间排序的本地算法，不强依赖向量库

### 6.3 迁移建议

**适配复用：**
1. side query 选择模式 → 可选增强：在高预算场景下用轻量模型对候选排序
2. `alreadySurfaced` 去重 → 直接复用思想：在 session metadata 记录已注入的 memory ID 列表
3. 预算限制（最多5条 + 内容截断）→ 当前项目已有 `MAX_RETRIEVED_MEMORY_ITEMS = 5`，保持一致

**重新实现：**
- 检索时机：当前项目应在第一次模型请求前同步检索（学习问答场景前置上下文更重要）
- 文件索引 → 数据库查询：`scanMemoryFiles()` 替换为 Prisma `memoryItem.findMany()`
- frontmatter header 扫描 → 直接读取 `MemoryItem.metadata.category`、`MemoryItem.importance`

**SKIP：**
- 文件型 memory directory 全文检索
- transcript grep 回退检索（CLI 特有）

## 7. 会话压缩

### 7.1 CCX 真实实现

**压缩子系统：**

| 文件 | 职责 |
|------|------|
| `src/services/compact/compact.ts` | 主压缩流程，`compactConversation()`, `buildPostCompactMessages()` |
| `src/services/compact/autoCompact.ts` | 自动压缩阈值，`calculateTokenWarningState()`, circuit breaker |
| `src/services/compact/microCompact.ts` | 微小压缩，清理旧 tool result |
| `src/services/compact/sessionMemoryCompact.ts` | 利用已有 session memory 优化压缩 |
| `src/services/compact/prompt.ts` | 压缩 prompt 模板 |
| `src/services/compact/postCompactCleanup.ts` | 压缩后清理 |
| `src/services/compact/grouping.ts` | 按 API round 分组消息 |

**阈值体系：**
- `AUTOCOMPACT_BUFFER_TOKENS = 13,000` — 预留输出空间
- `WARNING_THRESHOLD_BUFFER_TOKENS = 20,000` — 警告线
- `ERROR_THRESHOLD_BUFFER_TOKENS = 20,000` — 错误线
- `MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3` — 熔断

**autoCompact 触发条件：**
1. auto compact enabled（环境变量/设置）
2. token usage ≥ auto compact threshold
3. 连续失败次数 < 3

**CompactionResult 结构：**
- `boundaryMarker` — 记录触发类型、压缩前token、compacted message 范围
- `summaryMessages` — 模型生成的摘要
- `attachments` — post-compact 恢复附件（计划、Skill、后台 agent 状态）
- `hookResults` — pre/post compact hooks 结果
- `messagesToKeep` — preserved tail messages

**post-compact attachments 来源：**
- 最近读过的文件 → `generateFileAttachment()`
- 当前计划 → `getPlanFilePath()`
- 已发现 Skill → `getInvokedSkillsForAgent()`
- 后台 agent 状态 → `getAgentListingDeltaAttachment()`
- 工具搜索发现 → `getDeferredToolsDeltaAttachment()`

**preserved tail 保证：**
- `messagesToKeep` 保留最近的 assistant/user 消息
- 使用 `isCompactBoundaryMessage()` 定位最近的 boundary
- `getMessagesAfterCompactBoundary()` 提取未压缩部分

### 7.2 当前项目 A505 压缩

**关键文件：** `packages/ai-core/src/memory/a505-context-compression.ts`

**阈值：**
- `A505_WARNING_RATIO = 0.7` — 70% 窗口时警告
- `A505_COMPRESSION_RATIO = 0.8` — 80% 时建议压缩
- `A505_BLOCKING_RATIO = 0.95` — 95% 时阻截
- `A505_RESERVED_OUTPUT_TOKENS` — 预留输出空间
- `A505_RETAIN_RECENT_MESSAGE_COUNT` — 保留最近 N 条消息

**已有实现：**
- `shouldAutoCompress()` — 阈值判断
- `selectMessagesForCompression()` — 选择待压缩范围
- `createStructuredCompressionSummary()` — 结构化摘要
- `estimateConversationTokens()` — token 估算
- `buildActiveConversationContext()` — 构建当前上下文

### 7.3 逐项比较

| 特性 | 当前项目 (A505) | CCX | 评估 |
|------|----------------|-----|------|
| auto 阈值触发 | ✅ 三层 (warning/compress/blocking) | ✅ 多层 (warning/error/auto/blocking) | 当前较简洁但 CCX 更精细 |
| microcompact | ❌ 无 | ✅ 清理旧 tool result | 可增量补充 |
| session memory compact | ❌ 无 | ✅ 利用已有摘要 | REIMPLEMENT (低优先级) |
| post-compact attachments | ❌ 无 | ✅ 计划/Skill/agent 状态 | 需要重新设计适配 Web |
| preserved tail | ✅ RETAIN_RECENT | ✅ messagesToKeep | 兼容 |
| circuit breaker | ❌ 无 | ✅ 连续失败 3 次熔断 | 应适配复用 |
| reactive compact | ❌ 无 | ✅ API 返回 prompt too long | SKIP (Web 项目可用用户提示替代) |
| compact boundary | ✅ CompactionBoundary 类型 | ✅ boundaryMarker | 当前设计可满足需求 |

**迁移分类：**
- `A505_COMPRESSION_RATIO` 保留（当前项目已实现且合适）
- CCX 的 circuit breaker 适配复用（ADAPT_AND_REUSE）
- CCX 的 microcompact 增量补充（ADAPT_AND_REUSE，清理大 tool_result 内容）
- session memory compact 低优先级重新实现（REIMPLEMENT_FROM_DESIGN）
- reactive compact / snip compact 跳过（SKIP — CLI 特有）

## 8. Tool Definition (CCX vs 当前项目)

### 8.1 CCX 真实 Tool 协议

源码位置: `src/Tool.ts`。核心接口字段:

| 字段 | 必定/可选 | 用途 |
|------|----------|------|
| name, aliases, searchHint | 必定+可选 | 工具标识 |
| description(), prompt() | 必定 | 模型可见说明（函数形式） |
| inputSchema(z.ZodType) | 必定 | Zod 校验 |
| inputJSONSchema | 默认生成 | API 格式 |
| validateInput() | 可选 | 工具级自定义校验 |
| checkPermissions() | 可选 | 权限决策 |
| call(input, context) | 必定 | 实际执行 |
| isConcurrencySafe(), isReadOnly(), isDestructive() | 必定 | 安全分类 |
| maxResultSizeChars, shouldDefer, alwaysLoad | 可选 | 存储/加载控制 |

Tools 类型是简单字典 `Record<string, Tool>`，无显式 Registry 类。

### 8.2 当前项目三套工具定义

| 层 | 位置 | 核心接口 |
|----|------|---------|
| ai-core | `packages/ai-core/src/tools/types.ts` | ToolDefinition, ToolRegistration, ToolCallRequest/Result |
| agent-runtime | `packages/ai-core/src/agent-runtime/tools/tool-types.ts` | AgentTool, AgentToolMetadata, ToolExecutionResult |
| Web | `apps/web/src/lib/assistant/tools/tool-types.ts` | AssistantTool |

### 8.3 迁移建议

合并为一套。保留 `packages/ai-core/src/tools/types.ts` 的 ToolDefinition，增强:
- 从 CCX 借鉴: aliases, isConcurrencySafe, maxResultSizeChars, alwaysLoad
- 从 agent-runtime 借鉴: timeoutMs, category, allowedAgents
- 删除 CCX 的 description() 函数形式、Anthropic SDK 耦合方法

废弃 agent-runtime 和 Web 层的重复定义。

## 9. Tool Registry & Pool

CCX: `src/Tool.ts:Tools = Record<string, Tool>` + `src/tools.ts:getAllBaseTools()`
当前: 三套 Registry

合并方案: 以 `packages/ai-core/src/tools/registry.ts:InMemoryToolRegistry` 为基础，从 agent-runtime registry 迁移 freeze/reset/enable/disable/listByCategory。废弃 agent-runtime/tools/tool-registry.ts。

## 10. Tool 执行主链

CCX 调用链 (基于 toolOrchestration.ts + toolExecution.ts):

```text
模型输出 tool_use
→ partitionToolCalls() 按 isConcurrencySafe 分区
→ 并发批: runToolsConcurrently / 串行批: runToolsSerially
→ runToolUse():
  1. findToolByName()
  2. inputSchema.safeParse() — Zod 校验
  3. tool.validateInput() — 自定义校验
  4. runPreToolUseHooks() — hook 管线
  5. tool.checkPermissions() / canUseTool() — 权限
  6. tool.call() — 执行
  7. processToolResultBlock() — 大结果外置
  8. mapToolResultToToolResultBlockParam() — 模型格式
```

错误全部生成 is_error:true 的 tool_result, 保证每个 tool_use 都有对应结果。

### 迁移建议

保留当前 `SkeletonAgentToolExecutor` (比 InMemoryToolRuntime 完整), 从 CCX 适配:
- 并发分区逻辑 (ADAPT_AND_REUSE)
- 错误映射模式 (ADAPT_AND_REUSE)
- 结构化 tool_result 强制回灌 (ADAPT_AND_REUSE)

## 11. Tool 失败与回灌

CCX 所有失败生成结构化 tool_result:
- 未找到: `<tool_use_error>Error: No such tool available`
- Schema 失败: `<tool_use_error>Input validation error`
- 权限拒绝: `<permission-denied>...` + memory correction hint
- 异常: `<tool_use_error>{error.message}`
- 取消/超时: CANCEL_MESSAGE

当前项目问题: Tool 失败后不稳定回灌, 内部异常泄漏。

**方案:** 确保 Agent Loop 中每个 tool_use 都生成 ToolExecutionResult (成功/失败/拒绝/超时/取消), 强制回灌模型, 错误文本中文化, 异常不泄漏。

## 12. StreamingToolExecutor

CCX: `src/services/tools/StreamingToolExecutor.ts` — 流式接收 tool_use 时边收边执行。
与 Anthropic SDK 强耦合 (`ToolUseBlock`, `AssistantMessage`)。

迁移: REIMPLEMENT_FROM_DESIGN。Web 项目不需要流式工具执行 (Next.js 流式响应天然原子化)。但 `partitionToolCalls()` 并发分区逻辑可独立抽取。

## 13. ToolResultStorage

CCX: `src/utils/toolResultStorage.ts` — 大结果外置到 `{projectDir}/{sessionId}/tool-results/{toolUseId}.{json|txt}`, 生成 `<persisted-output>` 预览。

迁移: ADAPT_AND_REUSE。文件存储改数据库 Blob/S3, 预览算法直接复用, session 隔离保留。

## 14. Agent Runtime

CCX: QueryEngine + query.ts 主循环 + fork agent + task framework。
当前: assistant-multi-agent-runtime + assistant-orchestrator + assistant-server-actions (已实现)。

**NOT_FOUND:** `utils/task/framework.ts`, BashTool 后台任务转换, TaskOutputTool, useCanUseTool 完整权限链。需后续读取确认。

## 15. 取消/超时/重试

CCX: `AbortController` + `createChildAbortController()` + timeout via setTimeout。
当前: SkeletonAgentToolExecutor 已有基本实现, 多 Agent 支持取消/重试 (A509+)。

建议: CCX 的 child AbortController 模式直接适配, 当前项目重试机制已更完善。

## 16. 当前项目对应现状 (逐模块)

| 模块 | 当前文件 | 状态 | 与 CCX 对比 |
|------|---------|------|------------|
| Memory 类型 | `packages/ai-core/src/memory/types.ts` | ✅ 定义完整 | 比 CCX 更结构化 (MemoryLayer, MemoryItem, SearchResult) |
| Memory 契约 | `packages/ai-core/src/memory/contracts.ts` | ✅ 多层设计 | 比 CCX 更完整 (MemoryTier, Source, Status, Budget) |
| Memory 存储 | `packages/db/src/repositories/memory-repository.ts` | ✅ Prisma | CCX 是文件型，本项目 DB 型更适 Web |
| 显式记忆写入 | `apps/web/src/lib/assistant/assistant-intent-resolver.ts` | ✅ 确定性解析 | CCX 依赖模型判断，本项目更可控 |
| 后台抽取 | `packages/ai-core/src/memory/MemoryExtractor.ts` | ⚠️ 仅类型 | CCX 有完整 fork agent 抽取 |
| 记忆检索 | `packages/ai-core/src/memory/MemoryRetriever.ts` | ✅ 关键词算法 | CCX 用 side query (Sonnet)，本更轻量 |
| 压缩 | `packages/ai-core/src/memory/a505-context-compression.ts` | ✅ 三层阈值 | CCX 更精细 (microcompact + reactive) |
| Tool 定义 | `packages/ai-core/src/tools/types.ts` | ✅ | CCX 与 Anthropic SDK 耦合更深 |
| Tool 注册 | `packages/ai-core/src/tools/registry.ts` | ✅ | 需合并 agent-runtime registry |
| Tool 执行 | `packages/ai-core/src/agent-runtime/tools/tool-executor.ts` | ✅ 较完整 | 缺少并发分区和流式 |
| Agent 多任务 | `apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts` | ✅ | CCX 无对应 Web 级实现 |
| Agent 编排 | `apps/web/src/lib/assistant/assistant-orchestrator.ts` | ✅ | 本项目特有 |
| 会话管理 | `apps/web/src/lib/assistant/assistant-conversation-repository.ts` | ✅ | CCX 用 sessionStorage 文件 |
| 用户模型 | `apps/web/src/lib/assistant/providers/user-model-resolver.ts` | ✅ | CCX 使用 Anthropic SDK 直连 |
| 权限 | `packages/ai-core/src/agent-runtime/tools/tool-permission.ts` | ✅ | CCX 用 useCanUseTool hook |
| DB 持久化 | `packages/db/prisma/schema.prisma` | ✅ 多表 | CCX 无 DB 持久化 |
| Tool Result 存储 | ❌ 无 | ❌ | CCX 有 toolResultStorage.ts |

## 17. 迁移矩阵 — 逐项结论

### Memory

| 能力 | 分类 | 目标位置 |
|------|------|---------|
| 显式 remember/forget | SKIP (当前确定性方案更好) | — |
| 记忆类型分类 | DIRECT_REUSE (文本模板中文化) | ai-core/memory prompt 构建 |
| 后台 extractMemories | ADAPT_AND_REUSE (设计) | apps/web/lib background job |
| cursor 幂等 | ADAPT_AND_REUSE | memory-service.ts |
| 主流程跳过检查 | ADAPT_AND_REUSE | memory-service.ts |
| 记忆去重 | REIMPLEMENT (结构化逻辑) | memory-service.ts |
| 旧规则 superseded/archived | REIMPLEMENT | MemoryItem.status |
| 相关记忆检索 | ADAPT_AND_REUSE (简单版) | MemoryRetriever 增强 |
| 记忆扫描 | SKIP (DB 替代文件) | — |
| MEMORY.md 索引 | SKIP (文件型, DB 替代) | — |
| compact boundary | ALREADY_IMPLEMENTED (A505) | — |
| auto compact 阈值 | ALREADY_IMPLEMENTED (A505) | — |
| microcompact | ADAPT_AND_REUSE | a505 补充 |
| circuit breaker | ADAPT_AND_REUSE | a505 补充 |
| post-compact attachments | REIMPLEMENT_FROM_DESIGN | a505 补充 |
| reactive compact | SKIP (CLI 特有) | — |

### Tools

| 能力 | 分类 | 目标位置 |
|------|------|---------|
| ToolDefinition 协议 | ADAPT_AND_REUSE (字段选择) | ai-core/tools/types.ts |
| Tool 并发分区 | ADAPT_AND_REUSE | agent-runtime/tools |
| tool_result 错误映射 | ADAPT_AND_REUSE | agent-runtime/tools |
| 大结果 artifact | ADAPT_AND_REUSE | 新建 LargeToolResultStore |
| 并发安全标识 | ADAPT_AND_REUSE (字段) | ToolDefinition |
| 取消传播 | DIRECT_REUSE (模式) | agent-runtime/tools |
| schema 校验 | ALREADY_IMPLEMENTED | — |
| permission decision | ALREADY_IMPLEMENTED | — |
| StreamingToolExecutor | REIMPLEMENT_FROM_DESIGN | Web 不需要 |

### Agent/Task

| 能力 | 分类 |
|------|------|
| QueryEngine / queryLoop | ALREADY_IMPLEMENTED |
| transcript | SKIP (DB 替代) |
| task framework | NEEDS_MORE_RESEARCH |
| Agent/Subagent fork | SKIP (CLI 模式) |

## 18. DIRECT_REUSE 详细

| CCX 来源 | 搬运内容 | 目标 |
|----------|---------|------|
| utils/abortController.ts | createChildAbortController() 模式 | SkeletonAgentToolExecutor |
| services/tools/toolOrchestration.ts | partitionToolCalls() 算法 | agent-runtime tools |
| memdir/memoryTypes.ts | TYPES_SECTION_INDIVIDUAL 文本模板 (中文化) | ai-core memory prompt |

## 19. ADAPT_AND_REUSE 详细

| CCX 文件 | 保留 | 删除 | 目标 | 工作量 |
|----------|------|------|------|-------|
| extractMemories.ts | hasMemoryWritesSince, cursor 逻辑 | 文件系统依赖, fork agent | memory-service.ts | 中 |
| findRelevantMemories.ts | side query 选择设计 | 文件扫描, Sonnet 调用 | MemoryRetriever 增强 | 中 |
| toolResultStorage.ts | 持久化阈值算法, 预览格式 | 文件写入, session 目录 | 新建 LargeToolResultStore | 低 |
| toolOrchestration.ts | partitionToolCalls, canExecuteTool | ToolUseBlock 类型 | SkeletonAgentToolExecutor | 中 |
| autoCompact.ts | MAX_CONSECUTIVE_FAILURES circuit breaker | 模型依赖 | a505-context-compression | 低 |

## 20. REIMPLEMENT_FROM_DESIGN 详细

| 项目 | 不复用原因 | 建议接口 |
|------|-----------|---------|
| 记忆去重 | CCX 依赖模型判断，需结构化 | `deduplicateMemory(content, type) → create|update|skip` |
| 后台防并发队列 | CCX fire-and-forget 无控制 | `ExtractionQueue.enqueue(sessionId)` |
| post-compact 附件 | CCX 绑定 CLI 工具状态 | `generatePostCompactAttachments(session) → Attachment[]` |
| 同步记忆检索 | CCX 机会式不适合学习问答 | `retrieveForPrompt(query, userId) → MemoryContextBundle` |

## 21. ALREADY_IMPLEMENTED (无需处理)

| 能力 | 位置 | 评价 |
|------|------|------|
| Memory 类型/契约 | ai-core/memory/types.ts, contracts.ts | 比 CCX 更完整 |
| Memory 存储 | db/repositories/memory-repository.ts | Prisma 比文件型适合 Web |
| 显式写入 | assistant-intent-resolver.ts | 确定性优于模型判断 |
| A505 压缩 | ai-core/memory/a505-context-compression.ts | 三层阈值已实现 |
| Tool 执行器 | agent-runtime/tools/tool-executor.ts | 较完整 |
| Tool 权限 | agent-runtime/tools/tool-permission.ts | 与 canUseTool 等效 |
| 多 Agent 任务 | assistant-multi-agent-runtime.ts | CCX 无可比实现 |
| 取消/重试 | assistant-multi-agent-runtime.ts | 比 CCX 更完善 |

## 22. SKIP 清单

- 文件型记忆目录 (memdir/) — DB 替代
- BashTool / PowerShellTool — 安全风险
- MCP 工具生态 — 过于复杂
- Ink/CLI UI — 不适用 Web
- team memory — 不需要
- KAIROS daily log — 不需要
- reactive compact / snip compact — CLI 特有
- tool_search / deferred schema — 工具少不需要
- fork agent / subagent — CLI 模式

## 23. NEEDS_MORE_RESEARCH

1. `utils/task/framework.ts` — 任务注册/清理框架
2. BashTool → 后台任务转换 (`spawnShellTask`)
3. TaskOutputTool 输出读取
4. useCanUseTool 完整权限链
5. MCP Tool 是否共用执行链

## 24. MemoryItem 外键冲突方案

**问题：** `prisma.memoryItem.create()` 因 userId FK 必须引用真实 User 导致冲突。

**首选方案：** 改为 plain string（仿 ArticleFavorite 模式）

```prisma
model MemoryItem {
  userId String  // NOT a FK — dev session users may not have real User records
  // user relation removed
}
```

原因: dev session 用户无 User 记录，上层已通过服务端 session 保证隔离。与 BookFavorite/ProblemFavorite 等一致。

**备选方案：** 首次访问时 upsert User，但会污染 User 表。

**sessionId/sourceMessageId：** 都不应该是 DB 外键。记忆是独立长期记录，不应随 session/message 删除而级联删除。

## 25. 双层记忆机制设计

### 第一层：即时写入

触发: `resolveAssistantIntent()` → MEMORY_WRITE (中文指示词匹配)
流程: 提取内容 → 检查语义相似度 → 更新或新建 → 中文确认

### 第二层：后台归纳

触发: 主回答结束后 + cursor 后有 ≥5 条新消息 + 主流程未写入 + 无并发抽取
流程: after() callback → 构建 prompt → 轻量模型抽取 → dedup → update/create/supersede → 更新 cursor
失败: 只记录, 不重试。连续 3 次失败后当天不再尝试。

## 26. 可靠 Tool Loop 方案

```text
用户输入 → resolveIntent → 非CHAT直接处理 (MEMORY_WRITE/TASK_CONTROL)
→ CHAT → Agent Loop:
  白名单过滤 → schema校验 → 权限判断 → 超时执行
  → 结构化tool_result → 强制回灌 → 循环(maxTurns=10, maxToolCalls=20)
  → 最终答案 → 后台抽取
```

错误不泄漏: 所有异常→中文化消息("需要更多权限"/"操作超时"/"处理请求时出现问题")

## 27. 执行链 UI 方案

已完成: 处理中·计时 + 完成后折叠 (A509+)
需增强: 展示工具中文名称 + 数据来源 + 耗时 + 安全摘要
禁止展示: 原始Prompt/上下文/raw输入输出/Credential

## 28. 悬浮助手处理建议

保留悬浮助手为快捷入口(快速CHAT), `/ai` 页面为完整功能入口(多Agent+长期记忆+CF)。
不取消挂载, 明确范围即可。

## 29. 后续实施顺序

| 轮次 | 任务 | 闭环 |
|------|------|------|
| 1 | 修复 MemoryItem FK + 增强去重 | 用户说"记住XXX"→成功写入+确认 |
| 2 | 合并工具Registry + 增强执行器 | Tool失败不泄漏, 模型稳定决策 |
| 3 | 后台记忆归纳 (cursor+去重+替换) | 多轮对话后自动归纳 |
| 4 | 执行链UI完善 (中文名称+来源+耗时) | 执行过程清晰可见 |
| 5 | 悬浮助手整合 | 消除功能重复 |

## 30. 风险

| 风险 | 等级 | 缓解 |
|------|------|------|
| MemoryItem FK 改动 | 中 | 用 migration, 非破坏性 |
| Registry 合并 regression | 中 | 旧 Registry 作为 adapter 过渡 |
| 后台抽取烧模型 | 低 | 限制每天每会话 3 次 |
| 未确认的 CCX 能力 | 低 | 后续读取确认后设计 |

## 31. 旧分析修正

| 旧分析 | 真实源码 | 原因 |
|--------|---------|------|
| "queryLoop 显式函数" | query 递归循环, 无 queryLoop 名 | 基于目录推测 |
| "tools.ts/toolPool.ts" | Tool.ts 简单字典 | 基于目录推测 |
| "KAIROS 自动蒸馏" | gated behind feature('KAIROS') | 可能基于文档 |

## 32. 未确认问题

1. utils/task/framework.ts 精确实现
2. BashTool → 后台任务转换路径
3. TaskOutputTool 完整实现
4. useCanUseTool allow/deny/ask 匹配
5. MCP Tool 执行/权限链
6. session memory 文件生成方式
7. reactive compact 错误恢复策略
