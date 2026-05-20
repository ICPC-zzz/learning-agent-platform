# CCX 记忆与工具机制总分析

本文档合并 `docs/reference-analysis/ccx/*.md` 中已经完成的 CCX 分析结果，用于指导 Learning Agent Platform 后续 `packages/ai-core/memory`、`packages/ai-core/tools` 和 `packages/ai-core/agent` 的设计。

本轮合并严格遵守限制：

- 未读取 `E:\code\ccx` 的任何源码。
- 只基于已经生成的 `docs/reference-analysis/ccx/*.md` 分析文档。
- 未修改业务代码。
- 只创建本文档：`docs/reference-analysis/CCX_MEMORY_AND_TOOLS_ANALYSIS.md`。

## 1. ccx 项目总体结构

既有目录分析显示，`ccx` 的主体集中在 `src/`，根目录只观察到 `.idea/` 和 `src/`。从目录和后续分析结果看，它更接近一个复杂 CLI / Agent 运行时，而不是普通 Web 应用。

核心目录可以按能力归类：

```text
src/
  QueryEngine.ts                 会话入口，一个 conversation 对应一个 QueryEngine
  query.ts                       模型主循环：压缩、工具调用、记忆附件、递归继续
  context.ts                     system context / user context 装配入口
  services/compact/              上下文压缩、microcompact、session memory compact
  services/SessionMemory/        会话摘要/会话记忆相关能力
  services/extractMemories/      后台长期记忆抽取
  memdir/                        文件型长期记忆目录、索引、扫描和相关记忆选择
  tools/                         内置工具集合
  services/tools/                工具执行、权限、编排、流式工具执行
  tasks/                         本地/远程/后台任务类型
  utils/toolResultStorage.ts     大工具结果落盘、预览和上下文替换
  utils/task/                    任务输出和后台任务辅助机制
  commands/                      compact、memory、tasks、session 等命令入口
```

这套结构的关键特点是：会话状态、模型主循环、工具执行、压缩服务、长期记忆和后台任务分散在不同模块中，通过 `QueryEngine -> query.ts` 主链路组合起来。

## 2. 核心模块说明

`QueryEngine.ts` 是会话级入口。它维护 `mutableMessages`、`readFileState`、usage、权限状态和 transcript 写入。用户每次提交消息时，`QueryEngine.submitMessage()` 会把用户输入转换为消息，写入当前会话，再调用 `query()`。

`query.ts` 是 Agent 模型主循环。它负责在每次模型请求前处理 compact boundary、工具结果预算、microcompact、auto compact、相关记忆预取、模型流式输出、工具执行、工具结果回灌、后台附件注入和递归下一轮。

`context.ts` 负责基础上下文。`getSystemContext()` 提供运行环境信息，例如 git 状态；`getUserContext()` 读取用户/项目上下文和 memory files，并追加当前日期。

`services/compact/` 是压缩系统。它包含普通 compact、auto compact、microcompact、API context management、session memory compact、post-compact cleanup 和压缩 prompt。

`memdir/` 是长期记忆系统。它使用 `MEMORY.md` 作为入口索引，用 topic markdown 文件保存具体记忆，并通过 header/frontmatter 扫描和 side query 选择相关记忆。

`services/extractMemories/` 是后台记忆抽取。主回答结束后可以 fire-and-forget 启动 forked agent，把对未来有用的用户偏好、反馈、项目背景或外部引用写入 memory directory。

`Tool.ts`、`tools.ts` 和 `services/tools/` 构成工具系统。工具定义包含模型可见描述、输入输出 schema、权限检查、执行函数、结果映射和调度属性。执行层负责 schema 校验、权限/hook 判断、执行、错误封装和 `tool_result` 回传。

`tasks/` 与 `utils/task/` 支撑后台任务。既有分析确认 `LocalShellTask` 可以维护后台命令状态、输出文件和 task notification，任务完成后把摘要和输出引用注入后续上下文。

## 3. 三层记忆系统设计

CCX 的记忆系统可以理解为三层，但不是以一个显式 `MemoryManager` 类实现。

第一层是当前上下文 / 工作记忆：

- 运行时 `mutableMessages`。
- 当前 turn 的 system prompt、user context、system context。
- 用户输入、助手回复、tool result、progress、attachment。
- compact boundary 之后仍保留的近期消息。

这一层服务当前推理窗口，生命周期最短，直接进入模型请求。

第二层是压缩摘要 / 会话摘要：

- compact summary message。
- compact boundary metadata。
- preserved tail messages。
- post-compact attachments，例如最近读过的文件、计划、Skill、MCP 或后台 agent 状态。
- session memory compact 使用的 session memory 文件。

这一层服务长会话延续，用摘要和恢复附件替换旧消息，避免上下文无限增长。

第三层是长期记忆 / 可检索记忆：

- auto memory directory。
- `MEMORY.md` 入口索引。
- topic memory markdown 文件。
- 可选 team memory。
- 可选 KAIROS daily log 和后续蒸馏流程。

这一层服务跨会话复用，保存用户画像、协作反馈、项目背景和外部引用。

三层的关系可以概括为：

```text
Working messages
  -> 过长时 compact 成 SessionSummary
  -> 旧消息被 boundary + summary + attachments 替代
  -> 会话结束后抽取 LongTermMemory
  -> 后续 turn / session 检索相关记忆并作为附件回注入
```

## 4. 上下文压缩触发机制

CCX 的压缩触发发生在每次模型请求之前，而不是等整轮结束后再处理。

主要触发类型：

- microcompact：在 auto compact 前执行，优先清理旧 tool result、tool use 或 thinking blocks 等高体积低价值内容。
- auto compact：按 token 阈值自动触发。
- session memory compact：如果已有 session memory 且能找到 `lastSummarizedMessageId`，优先用已有摘要构造 compact 结果。
- manual compact：用户或命令显式触发。
- reactive compact：当 API 返回 prompt too long / media too large 等错误后尝试补救压缩。
- blocking limit：当无法压缩且上下文接近极限时，直接返回 prompt-too-long 错误。

既有分析确认的关键阈值思路：

- 给 summary 输出预留预算，不能等 context window 满了才压缩。
- auto compact 使用 effective context window 减去固定 buffer。
- warning / error / blocking 分层处理。
- auto compact 可被环境变量、用户设置、query source、reactive-only 或 context-collapse 模式禁用。
- auto compact 连续失败会进入 circuit breaker，避免无限烧模型调用。

这对本项目的启发是：压缩触发应有 warning、auto、blocking 三类阈值，并记录触发原因、压缩前 token、压缩范围和失败次数。

## 5. 上下文压缩输入与输出

普通 compact 的输入是 compact boundary 之后仍在当前工作上下文里的消息，同时会携带 system prompt、user context、system context、tool use context 和 fork context messages 等 cache-safe 参数。

普通 compact 在发送总结请求前会清理输入：

- 去掉图片内容。
- 去掉已重新注入过的 attachment。
- 只总结最近 compact boundary 之后的消息。
- 限制 compact agent 的工具权限，避免总结过程中调用工具。

session memory compact 的输入不同：它优先读取已有 session memory 文件，再根据 `lastSummarizedMessageId` 保留未总结尾部消息，并避免切断 `tool_use / tool_result` 这类 API 不变量。

microcompact 的输入主要是历史 tool result 块。它可以通过 cache edit 或本地替换，把旧工具结果内容替换为占位文本或预览。

普通 compact、session memory compact 和 reactive compact 最终统一输出 `CompactionResult`，包含：

```text
CompactionResult
  - boundaryMarker
  - summaryMessages
  - attachments
  - hookResults
  - messagesToKeep?
  - userDisplayMessage?
  - preCompactTokenCount?
  - postCompactTokenCount?
  - truePostCompactTokenCount?
  - compactionUsage?
```

`buildPostCompactMessages()` 固定输出顺序：

```text
boundaryMarker
summaryMessages
messagesToKeep
attachments
hookResults
```

summary message 是模型可继续使用的会话摘要；boundary marker 记录触发类型、压缩前 token、压缩前最后消息、工具 schema 状态和 preserved segment 信息。

## 6. 压缩摘要如何保存与回注入

压缩结果会进入三个位置。

第一，当前运行时消息数组。`query.ts` 把 `messagesForQuery` 替换为 post-compact messages；`QueryEngine` 收到 compact boundary 后裁剪 `mutableMessages` 中 boundary 之前的旧消息。

第二，transcript / resume 记录。`QueryEngine` 会写入 assistant、user 和 compact boundary。写 boundary 前会先 flush preserved segment tail，避免恢复时找不到 tail uuid。

第三，session memory 文件。session memory compact 使用已有 session memory 文件作为摘要来源；如果内容过长，会截断并在 summary 中追加完整文件路径。

回注入方式不是“删除旧消息后裸跑”，而是：

```text
旧历史
  -> compact boundary
  -> compact summary
  -> preserved tail messages
  -> post-compact attachments
  -> 下一轮模型请求从最近 boundary 后开始
```

post-compact attachments 很重要。它把摘要不适合承载但模型继续工作需要的状态补回来，例如最近读过的文件、当前计划、已调用 Skill、后台 agent 或工具状态。

本项目应迁移这种思想，但不要绑定到 CCX 的具体工具。建议抽象成 `ContextAttachment`，由 book、task、skill、memory、tool 模块分别提供。

## 7. 对话记忆写入机制

CCX 的长期对话记忆写入有两条路径。

第一条是主 Agent 直接写入。auto memory 开启时，memory prompt 会告诉模型存在一个持久化 memory directory；用户明确要求 remember 时，模型可以通过 Write/Edit 写入 topic memory 文件并更新 `MEMORY.md` 索引；用户要求 forget 时，模型应删除或修改相关记忆。

第二条是后台抽取 agent。一次完整 query loop 结束后，`executeExtractMemories()` 可以 fire-and-forget 启动 forked agent，读取最近一段对话，提取未来仍有价值的信息，写入 memory directory。

后台抽取的关键约束：

- 只对主 agent 运行，不对 subagent 运行。
- auto memory 未启用时不运行。
- remote mode 跳过。
- 不阻塞主回答，失败只记录。
- 如果已有抽取在运行，会合并后续请求，只保留最新上下文做 trailing run。
- 如果主 agent 本轮已经写过 memory，后台抽取会跳过，避免重复保存。

CCX 写入的长期记忆类型主要有 4 类：

- `user`：用户角色、目标、职责、知识背景、偏好。
- `feedback`：用户对 agent 工作方式的纠正、确认和原因。
- `project`：项目背景、目标、决策、事故、截止日期和协调约束。
- `reference`：外部系统入口，例如项目、看板、频道或资料链接。

它明确不保存可从当前项目状态重新得到的信息，例如代码结构、git 历史、当前修复配方、临时任务状态和已写入项目文档的事实。

对本项目来说，主 Agent 直接写文件的方式不应迁移。长期记忆写入应走结构化 `MemoryStore` API、schema 校验、权限判断和审计日志。

## 8. 对话记忆检索机制

CCX 的长期记忆检索也分两层。

第一层是入口索引。`MEMORY.md` 作为短索引进入 user context，让模型知道有哪些记忆主题可用。它不保存完整内容，主要是一行一条的 topic 指针。

第二层是相关记忆自动检索。`query.ts` 在每个用户 turn 开始时启动 `startRelevantMemoryPrefetch()`，它不阻塞主模型请求，而是在模型流式输出和工具循环期间并行运行。

检索候选来自 memory 文件 header：

- 递归扫描 memory directory 下 `.md` 文件。
- 排除 `MEMORY.md`。
- 每个文件只读取 frontmatter 前若干行。
- 得到 `filename`、`filePath`、`mtimeMs`、`description`、`type`。
- 按更新时间排序，最多保留候选 header。

相关性选择不是直接全文搜索，而是通过 side query 在 manifest 上保守选择：

```text
Query: <last user query>

Available memories:
- [type] filename (timestamp): description

Recently used tools: <optional tool list>
```

side query 要求只返回明确有用的文件名，最多 5 个；不确定就返回空。返回结果还会经过存在性过滤、去重、已注入过滤、已读文件过滤和总预算限制。

这套机制的核心价值是噪音控制：候选基于短描述，选择器保守，注入数量有限，并且同一 session 不重复注入。

## 9. 记忆检索结果如何进入 prompt

CCX 的记忆进入 prompt 有两种方式。

第一，`MEMORY.md` 入口索引作为 user context 的一部分进入会话。这是轻量、常驻的记忆导航。

第二，相关记忆内容作为 attachment 机会式进入后续模型上下文。流程是：

```text
turn 开始
  -> startRelevantMemoryPrefetch()
  -> 主模型请求和工具执行并行进行
  -> prefetch 完成后读取相关 memory 文件片段
  -> 封装为 relevant_memories attachment
  -> createAttachmentMessage()
  -> yield 给外层并追加到 toolResults
  -> 下一轮递归模型调用看到这些记忆
```

读取时会限制单文件行数和字节数。如果内容被截断，会提示模型可用 FileRead 读取完整文件。每条记忆带 header，包含保存时间和绝对路径。

这个设计适合 CLI coding agent，因为模型可以先回答或调用工具，相关记忆在后续工具循环中补进来。但本项目的学习问答场景通常要求课程上下文、学习进度和用户能力记忆在第一轮回答前就可用。因此本项目不应完全采用机会式注入，而应在 `buildPrompt()` 前同步执行必要检索，再把结果作为 `ContextAttachment` 放入初始 prompt。

## 10. 后台工具调用机制

CCX 的工具调用主链路是标准 `tool_use -> tool execution -> tool_result` 闭环。

工具定义包含：

- `name` / `aliases` / `searchHint`
- `description()` / `prompt()`
- `inputSchema` 或 `inputJSONSchema`
- `outputSchema`
- `validateInput()`
- `checkPermissions()`
- `call()`
- `mapToolResultToToolResultBlockParam()`
- `isConcurrencySafe()` / `isReadOnly()` / `isDestructive()`
- `interruptBehavior()` / `requiresUserInteraction()`
- `maxResultSizeChars` / `shouldDefer` / `alwaysLoad`

工具注册和过滤由 `tools.ts`、`toolPool.ts` 和权限上下文共同完成。被明确 deny 的工具会在暴露给模型前过滤，执行期仍会再次校验。

工具执行流程：

```text
模型输出 tool_use
  -> query.ts 收集 tool_use block
  -> StreamingToolExecutor 或 runTools()
  -> runToolUse()
  -> schema 校验
  -> 工具级 validateInput()
  -> PreToolUse hooks
  -> 权限 / hook decision
  -> tool.call()
  -> progress / final result
  -> mapToolResultToToolResultBlockParam()
  -> user-side tool_result
```

后台/异步机制有两类：

- `StreamingToolExecutor`：模型流式输出 tool_use 时提前开始执行工具，不必等完整 assistant 响应结束。
- 后台任务系统：例如 `LocalShellTask` 可以把长命令转为后台任务，维护 `running / completed / failed / killed` 状态，保存输出文件，并在完成后排入 task notification。

`TaskCreateTool` 负责创建任务记录，`LocalShellTask` 负责后台 shell 任务状态和输出。既有分析没有继续确认 BashTool 如何进入 `spawnShellTask()`，因此后台 shell 细节仍是待验证问题。

## 11. 工具调用日志与结果回传

CCX 的工具结果以 user message 中的 `tool_result` block 回传模型：

```text
tool_result
  - tool_use_id
  - content
  - is_error?
```

成功、失败、权限拒绝、输入校验失败、未知工具、取消、中断和异常都会生成结构化 `tool_result`，避免出现有 `tool_use` 但没有对应结果的非法上下文。

大结果不会无限塞进 prompt。`toolResultStorage` 会把超大工具结果写入 session 的 `tool-results` 目录，再把模型可见内容替换为：

- 输出过大的说明。
- 完整输出保存路径。
- 预览内容。
- artifact / file 引用。

后台任务也遵循类似思路：长任务返回 task id、状态、摘要和输出文件路径，完整输出通过文件引用读取。

日志方面，CCX 已看到多处事件和 span：

- 工具执行成功/失败。
- 权限允许/拒绝。
- 进度消息。
- streaming tool execution 是否使用。
- 大结果落盘。
- message-level budget enforcement。
- OTel span/event。

但它不是一个清晰单表式 `ToolRunLogger`。本项目应把这些维度设计成结构化日志模块，至少记录 toolRunId、toolUseId、toolName、触发来源、输入摘要、权限决策、执行状态、耗时、结果摘要、artifact 引用、错误信息和是否写入上下文。

## 12. Agent 如何组合记忆、压缩、工具调用

CCX 的主组合链路可以概括为：

```text
QueryEngine.submitMessage()
  -> 追加 user message 到 mutableMessages
  -> 写入 transcript
  -> query()
  -> queryLoop()
      -> startRelevantMemoryPrefetch()
      -> getMessagesAfterCompactBoundary()
      -> applyToolResultBudget()
      -> microcompact()
      -> autoCompactIfNeeded()
      -> prependUserContext()
      -> appendSystemContext()
      -> call model with tools
      -> collect assistant messages
      -> execute tool_use blocks
      -> collect tool_result messages
      -> collect task notifications / memory attachments
      -> recursively continue if needed
  -> QueryEngine 追加 yielded messages
  -> transcript 记录 assistant/user/attachment/boundary
  -> 遇到 compact boundary 后裁剪旧 mutableMessages
  -> query loop 结束后异步抽取长期记忆
```

组合顺序上的关键点：

- 压缩在每次模型请求前执行。
- 工具结果进入下一轮模型请求前会先做预算控制。
- 相关记忆检索在 turn 开始时预取，但正文注入是机会式。
- 工具结果、后台任务通知和相关记忆附件都作为 user-side message 进入后续上下文。
- transcript 用于恢复对话，工具/任务/记忆日志用于审计和后续沉淀。

本项目可以借鉴“会话入口 + 主循环”的分层，但应调整记忆检索时机：学习问答和 Agent 任务前置上下文必须先检索，再请求模型。

## 13. 哪些设计适合迁移到我的项目

适合迁移的是机制，不是代码。

可迁移设计包括：

- 工作记忆、会话摘要、长期记忆三层分离。
- compact boundary 明确记录压缩触发、来源范围、token 估计和保留尾部。
- 压缩后通过 summary + preserved tail + attachments 回注入上下文。
- 先清理低价值大工具结果，再做完整摘要。
- 给 summary 预留输出预算，并设计 warning / auto / blocking 阈值。
- 长期记忆限定高价值类型，避免“什么都记”。
- 记忆记录必须有检索描述和来源。
- 检索结果作为 `ContextAttachment` 注入，带来源、时间、预算和截断状态。
- 后台记忆抽取不阻塞主回答，失败只记录。
- 工具定义同时包含模型可见描述、schema、风险属性、执行函数和结果映射。
- 工具池按权限过滤，执行期二次检查。
- 工具结果永远回传结构化 `tool_result`，包括失败和拒绝。
- 大工具结果外置为 artifact，只把摘要、预览和引用放入上下文。
- 长任务返回 task id、状态、摘要和输出引用。
- transcript 和审计日志分离。

## 14. 哪些代码不应该直接迁移

不应该直接迁移的部分包括：

- 不应让模型直接 Write/Edit 本项目核心长期记忆文件。
- 不应把 markdown 文件系统作为长期记忆唯一真相。
- 不应依赖 transcript grep 作为主检索方式。
- 不应保存代码结构、当前文件事实、git 历史等可实时验证的信息快照。
- 不应照搬 team memory、KAIROS daily log、context collapse、cached microcompact 等成熟产品分支。
- 不应早期依赖服务端 cache editing。
- 不应把压缩恢复附件绑定到具体工具实现。
- 不应迁移任意 Bash / PowerShell / 文件写入等高风险工具作为 MVP 能力。
- 不应迁移与 React/Ink UI 强绑定的工具核心代码结构。
- 不应默认记录完整工具输入输出到遥测或日志。
- 不应把相关记忆全文完全做成机会式注入。
- 不应把 CCX 的 permission hook 当成本项目完整自主性策略。

本项目更需要的是结构化存储、权限边界、审计日志和可解释策略，而不是复制 CCX 的文件型记忆和成熟 CLI 运行时。

## 15. 对我项目 ai-core/memory 的具体设计建议

建议在 `packages/ai-core/src/memory` 中显式设计三层结构：

```text
memory/
  WorkingMemoryStore.ts
  SessionSummaryStore.ts
  LongTermMemoryStore.ts
  MemoryCompressor.ts
  MemoryExtractor.ts
  MemoryRetriever.ts
  MemoryContextBuilder.ts
  MemoryAuditLog.ts
```

建议核心类型：

```text
WorkingMessage
  - id
  - sessionId
  - role
  - content
  - attachments
  - createdAt

CompactionBoundary
  - id
  - sessionId
  - trigger: manual | auto | reactive
  - sourceMessageIds
  - sourceMessageRange
  - preTokenEstimate
  - postTokenEstimate
  - preservedTailMessageIds
  - summaryId
  - createdAt

SessionSummary
  - id
  - sessionId
  - boundaryId
  - summaryText
  - currentGoal
  - keyDecisions
  - completedSteps
  - pendingTasks
  - resources
  - errorsAndFixes
  - nextStep
  - sourceMessageIds
  - createdAt

LongTermMemory
  - id
  - scope: user | workspace | project | course | skill
  - type: user_profile | feedback | project_context | external_reference
  - title
  - description
  - content
  - sourceConversationId
  - sourceMessageIds
  - confidence
  - status: active | stale | archived | deleted
  - createdAt
  - updatedAt
  - expiresAt?

MemoryRetrievalResult
  - memoryId
  - score
  - reason
  - source
  - freshness
  - contentPreview
```

建议核心流程：

```text
appendWorkingMessages(sessionId, messages)
buildWorkingContext(sessionId)
compactSession(sessionId, trigger)
persistBoundaryAndSummary(boundary, summary)
extractLongTermCandidates(sessionId, sinceCursor)
saveLongTermMemory(record)
retrieveMemories(query, scope, limit, budget)
buildMemoryAttachments(results)
recordMemoryAudit(event)
```

MVP 策略：

- 先做结构化记录，不做文件型 memory directory。
- 长期记忆只允许保存用户画像、协作反馈、项目背景、外部引用。
- 每条长期记忆必须有来源消息和更新时间。
- 检索先用关键词 + scope + 更新时间排序，不强依赖向量库。
- 注入最多 5 条，总 token 预算受控。
- 用户说“不要用记忆”时，检索器返回空并记录禁用原因。
- 代码、文件、课程正文等可验证事实只能把记忆当线索，不能当权威。

## 16. 对我项目 ai-core/tools 的具体设计建议

建议在 `packages/ai-core/src/tools` 中建立结构化工具运行时：

```text
tools/
  ToolDefinition.ts
  ToolRegistry.ts
  ToolExecutor.ts
  ToolExecutionContext.ts
  ToolResult.ts
  ToolRunLogger.ts
  ToolResultStore.ts
  BackgroundToolTask.ts
  ToolPermissionGate.ts
```

`ToolDefinition` 至少包含：

- name
- description
- inputSchema
- outputSchema
- riskLevel
- requiredAutonomy
- requiredPermissions
- isReadOnly
- isDestructive
- isConcurrencySafe
- canRunInBackground
- execute()
- mapResultForModel()

`ToolExecutor` 执行顺序建议：

```text
resolve tool
  -> validate input schema
  -> validate tool-specific input
  -> AutonomyPolicyEngine decision
  -> allow / deny / require_confirmation
  -> execute tool
  -> store large result if needed
  -> write ToolRunLogger events
  -> return ToolResultMessage
```

`ToolRunLogger` 应记录：

- toolRunId / toolUseId
- toolName
- taskId / sessionId / skillRunId
- triggerSource
- inputSummary
- riskLevel
- policyDecision
- startedAt / finishedAt
- status
- outputSummary
- artifactRefs
- error
- whetherResultInjectedToPrompt

MVP 工具建议只开放安全 mock 或只读工具：

- `ListLearningMaterials`
- `GetBookChapterContext`
- `SearchImportedContent`
- `GetPracticeRecommendation`

暂不开放任意 shell、危险文件写入、网络发布、凭据读取和无确认后台任务。

## 17. 对我项目 ai-core/agent 的具体设计建议

建议把 Agent 拆成会话入口和运行主循环两层：

```text
agent/
  AgentSession.ts
  AgentRuntime.ts
  TurnLoop.ts
  ContextAssembler.ts
  PromptBuilder.ts
  AgentTaskStore.ts
  AgentTranscriptStore.ts
  AgentAuditLogger.ts
```

建议 `AgentRuntime.runTurn()` 的 MVP 流程：

```text
runTurn(input)
  -> appendUserInputToWorkingMemory()
  -> writeTranscript(user input)
  -> loadBaseContext()
  -> retrieveRequiredMemoryBeforePrompt()
  -> buildContextAttachments()
  -> maybeCompactBeforeModelCall()
  -> buildPrompt()
  -> callModel()
  -> collectAssistantMessages()
  -> executeToolUses()
  -> appendToolResults()
  -> collectBackgroundNotifications()
  -> maybeContinueModelLoop()
  -> emitFinalResponse()
  -> runPostTurnMemoryExtraction()
  -> writeTranscriptAndAuditLogs()
```

与 CCX 的关键差异：

- 本项目应在第一轮模型请求前同步检索必要记忆和学习上下文。
- 所有工具调用前必须进入 `AutonomyPolicyEngine`。
- transcript 只负责恢复对话，工具、任务、权限、记忆另走审计日志。
- 后台任务必须有 `taskId`、状态、摘要、artifact 引用和取消入口。
- MemoryExtractor 生成候选记忆后应走结构化写入，不让模型直接写存储文件。

## 18. 推荐迁移顺序

推荐迁移顺序从安全边界和最小闭环开始：

1. 定义共享枚举和协议：任务状态、工具风险等级、自主性模式、policy decision、memory type。
2. 建立 `WorkingMemoryStore` 和 transcript 记录。
3. 建立 `SessionSummary` 与 `CompactionBoundary` 类型，先支持手动 compact。
4. 增加 auto compact 阈值和失败熔断。
5. 建立 `LongTermMemoryStore`，只做结构化 CRUD。
6. 建立 `MemoryRetriever`，先用关键词/scope/更新时间排序。
7. 建立 `ToolDefinition`、`ToolRegistry`、`ToolExecutor`。
8. 接入 `AutonomyPolicyEngine`，所有工具执行前强制判断。
9. 建立 `ToolRunLogger` 和 `ToolResultStore`。
10. 建立 `AgentRuntime` 主循环，把 memory、prompt、tool、transcript 串起来。
11. 增加后台任务抽象，只保存 task id、状态、摘要和 artifact 引用。
12. 最后再做 `MemoryExtractor` 异步候选抽取和 Skill 草案沉淀。

这个顺序避免先做复杂智能化，而是先把可审计、可回滚、可解释的运行边界建起来。

## 19. MVP 阶段应该只实现哪些部分

MVP 阶段只建议实现：

- 当前会话工作记忆。
- transcript 记录。
- 手动 compact。
- 简单 auto compact 阈值。
- `CompactionBoundary + SessionSummary + preserved tail`。
- 结构化长期记忆 CRUD。
- 长期记忆类型限制：用户画像、反馈、项目背景、外部引用。
- 简单关键词/scope 检索，最多 5 条。
- `ContextAttachment` 注入，带来源和更新时间。
- 少量只读或 mock 工具。
- 工具 schema 校验。
- 工具执行前 autonomy 判断。
- 结构化 `ToolRunLogger`。
- 大工具结果 artifact 引用。
- Agent 主循环的最小 `tool_use -> tool_result` 闭环。
- 主回答结束后的记忆候选抽取，但可以先要求用户确认后写入。

对于学习网站 MVP，优先让章节问答能可靠拿到当前书籍/章节/选中文本/用户学习进度，而不是先做复杂跨会话记忆。

## 20. 暂时不应该实现哪些复杂能力

暂时不应该实现：

- 任意 Bash / PowerShell / shell 后台执行。
- 危险文件写入、删除、发布、凭据操作。
- 自动执行社区 Skill。
- 让模型直接维护长期记忆文件。
- team memory / shared memory。
- KAIROS daily log 和夜间蒸馏。
- cached microcompact / API context management。
- context collapse。
- ToolSearch / deferred schema 的复杂工具发现。
- 完整 MCP 工具生态。
- 高自主性后台长任务。
- 复杂向量库和 LLM rerank 组合。
- 自动从所有工具结果写长期记忆。
- 自动生成并自动启用 Skill。
- 大规模实时日志基础设施。

这些能力都可以作为后续增强，但在 MVP 前会放大安全、权限、调试和上下文复杂度。

## 21. 后续需要进一步验证的问题

如果后续继续分析 CCX，需要新开对话并按小范围读取源码。当前仍需验证的问题包括：

1. `executeExtractMemories()` 在 query 结束阶段的精确触发点。
2. `MEMORY.md` 入口索引如何完整进入 user context。
3. `relevant_memories` attachment 最终渲染成什么 prompt 文本。
4. BashTool 如何决定前台执行、后台执行、超时和 background hint。
5. TaskOutputTool 如何让模型读取后台任务输出。
6. TaskGetTool / TaskListTool 如何暴露后台任务状态。
7. `utils/task/framework.ts` 如何注册、更新和清理 task state。
8. `useCanUseTool` 如何桥接权限策略、用户确认、非交互模式和 tool decision log。
9. Permission rules 如何解析 allow / deny / ask。
10. shell command prefix 如何匹配权限规则。
11. 工具执行结果是否被长期记忆抽取流程直接消费。
12. MCP 工具是否完全共用内置工具的权限和结果映射管线。
13. session memory compact 的 session memory 文件如何生成和更新。
14. reactive compact 的具体错误恢复策略。
15. tool use summary 是否进入后续 prompt、UI 或日志。

## 结论

CCX 对本项目最有价值的是一套成熟 Agent 运行时思想：三层记忆、compact boundary、压缩后附件回注入、长期记忆保守检索、工具定义与执行闭环、大结果外置、后台任务引用和 transcript / 审计日志分离。

但 CCX 的实现形态明显服务于成熟 CLI coding agent。Learning Agent Platform 不应直接迁移它的文件型长期记忆、任意 shell 执行、复杂 feature gate、机会式记忆注入和 UI 绑定工具结构。

本项目更合适的路线是：借鉴 CCX 的运行机制，重建结构化、安全可审计的 `MemoryManager + ToolRuntime + AgentRuntime`。MVP 只做低风险、可解释、可追溯的最小闭环，等权限、日志和压缩边界稳定后，再逐步扩展长期记忆、后台任务和 Skill 自动化能力。
