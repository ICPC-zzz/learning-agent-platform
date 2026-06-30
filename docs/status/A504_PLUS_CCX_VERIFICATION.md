# A504+ CCX 源码核验与记忆底座补齐报告

Date: 2026-06-27

## 1. 结论

A504+ 完成了 CCX 记忆与工具体系的定向源码核验，并补齐了当前项目后续三层记忆、上下文预算和压缩请求所需的最小 clean-room 契约。

CCX 根目录缺失 `LICENSE`、`NOTICE`、`package.json`。因此本轮停止复制或适配 CCX 实现代码，只允许源码阅读、核验报告和 clean-room 契约设计。实际新增代码均为本项目独立重写，没有 COPY CCX 源码、注释或测试。

## 2. CCX 许可证和 NOTICE 结论

实际检查：

- `E:\code\ccx\LICENSE` - NOT FOUND
- `E:\code\ccx\NOTICE` - NOT FOUND
- `E:\code\ccx\package.json` - NOT FOUND

处理结论：

- 许可证缺失，不能根据仓库文件确认复制、修改或再分发权限。
- 本轮不执行 COPY 或 ADAPT CCX 源码。
- 只进行源码核验与 clean-room REWRITE。

## 3. A504 审计

### A504 已完成部分

- `packages/ai-core/src/tools` disabled-by-default。
- 工具权限评估。
- 工具输入校验。
- 安全错误脱敏。
- 客户端 `userId` 剥离。
- `@learning-agent-platform/ai-core/tools` 子路径导出。
- `tests/a504-tools-runtime.test.mjs` 8 项测试。

### A504 原要求遗漏部分

- `docs/reference-analysis/CCX_MEMORY_AND_TOOLS_ANALYSIS.md` 明确写明未读取 `E:\code\ccx` 源码。
- `docs/status/A504_CCX_MEMORY_TOOLS_PORTING_REPORT.md` 有 CCX 文件和符号说明，但许可证结论依赖用户授权而非仓库内许可证。
- A504 没有落地上下文预算、压缩请求、三层记忆来源/状态等底层契约。

### A504+ 实际补齐部分

- 重新检查 CCX 根目录许可证入口。
- 定向读取 CCX 工具、权限、记忆、上下文预算、压缩相关源码。
- 建立真实源码核验表。
- 新增 `packages/ai-core/src/memory/contracts.ts`，clean-room 定义记忆分层、来源、候选/记录、上下文预算、压缩请求/结果和默认拒绝写入策略。
- 新增 A504+ 测试覆盖 memory 子路径、runtime 值、预算边界、压缩原因和默认拒绝写入。

## 4. 实际阅读的 CCX 文件清单

- `E:\code\ccx\LICENSE` - NOT FOUND
- `E:\code\ccx\NOTICE` - NOT FOUND
- `E:\code\ccx\package.json` - NOT FOUND
- `E:\code\ccx\src\Tool.ts`
- `E:\code\ccx\src\tools.ts`
- `E:\code\ccx\src\query\tokenBudget.ts`
- `E:\code\ccx\src\services\tools\toolExecution.ts`
- `E:\code\ccx\src\services\tools\StreamingToolExecutor.ts`
- `E:\code\ccx\src\services\compact\compact.ts`
- `E:\code\ccx\src\services\compact\autoCompact.ts`
- `E:\code\ccx\src\services\compact\microCompact.ts`
- `E:\code\ccx\src\services\compact\sessionMemoryCompact.ts`
- `E:\code\ccx\src\memdir\memoryTypes.ts`
- `E:\code\ccx\src\memdir\memoryScan.ts`
- `E:\code\ccx\src\memdir\findRelevantMemories.ts`
- `E:\code\ccx\src\memdir\paths.ts`
- `E:\code\ccx\src\services\extractMemories\extractMemories.ts`
- `E:\code\ccx\src\services\SessionMemory\sessionMemory.ts`

没有读取 `E:\code\harness-main` 或 `E:\code\claude-desktop-app-main`。

## 5. 与既有分析文档一致项

- CCX 的工具核心不是 `BaseTool` 类，而是 `Tool`、`ToolDef`、`buildTool()`。
- CCX 工具池由 `src/tools.ts` 中的函数组合：`getAllBaseTools()`、`getTools()`、`assembleToolPool()`。
- CCX 工具执行链包含 schema 校验、工具级 `validateInput()`、hook/permission、执行、结构化 `tool_result`。
- `StreamingToolExecutor` 存在，但与 CCX streaming message 状态强耦合。
- CCX 长期记忆是 memdir 文件体系，记忆类型为 `user | feedback | project | reference`。
- CCX 相关记忆选择基于 memory file header manifest 和 side query，最多选择 5 个。
- CCX 自动压缩包含 token threshold、warning/error/blocking、summary 输出预算和连续失败熔断。

## 6. 与既有分析文档不一致或需修正项

- A504 文档说“用户授权可搬运”，但本轮按任务许可证门禁重新判定：仓库内许可证缺失时不能 COPY/ADAPT 源码。
- `CCX_MEMORY_AND_TOOLS_ANALYSIS.md` 的标题是总分析，但正文明确说明未读 CCX 源码；本轮报告以真实源码为准。
- CCX 中没有独立 `ToolRegistry`/`ToolExecutor` 类；对应能力是 `tools.ts` 函数组装和 `runToolUse()` 执行函数。
- CCX 的 token budget 文件 `src/query/tokenBudget.ts` 处理 turn continuation budget，不等同于 auto compact 上下文预算；后者主要在 `services/compact/autoCompact.ts`。

## 7. 真实源码核验表

| 能力 | CCX 实际路径 | 实际符号 | 主要依赖 | 当前项目已有实现 | 处理结论 |
| --- | --- | --- | --- | --- | --- |
| BaseTool | `src/Tool.ts` | NOT FOUND；实际为 `Tool`, `ToolDef`, `buildTool` | `zod/v4`, Anthropic SDK blocks, MCP types, app state, permission types | 有，`ToolDefinition` | SKIP CCX；保留当前公共 Runtime |
| ToolRegistry | `src/tools.ts` | NOT FOUND class；实际为 `getAllBaseTools`, `getTools`, `assembleToolPool` | 内置工具、MCP tools、permission deny rules、feature flags | 有，`InMemoryToolRegistry` | SKIP CCX；不新增第二套注册器 |
| ToolExecutor | `src/services/tools/toolExecution.ts` | NOT FOUND class；实际为 `runToolUse`, `streamedCheckPermissionsAndCallTool` | `Tool`, hooks, permissions, analytics, messages | 有，`InMemoryToolRuntime` | SKIP CCX；A504 已加固 |
| StreamingToolExecutor | `src/services/tools/StreamingToolExecutor.ts` | `StreamingToolExecutor` | streaming `ToolUseBlock`, `ToolUseContext`, concurrency state, abort controller | 无公共实现 | SKIP；耦合 CCX streaming |
| 权限检查 | `src/Tool.ts`, `src/services/tools/toolExecution.ts`, `src/utils/permissions/*` | `checkPermissions`, `resolveHookPermissionDecision`, `canUseTool` | permission context, hooks, UI/interactive prompt | 有，`defaultToolPermissionEvaluator` | SKIP CCX；保持 deny-by-default |
| 输入校验 | `src/services/tools/toolExecution.ts`, `src/Tool.ts` | `inputSchema.safeParse`, `validateInput` | Zod schema, tool-specific validator | 有，`validateToolInputAgainstSchema` | SKIP CCX；保留轻量 schema |
| Memory Store | `src/memdir/memdir.ts`, `src/memdir/paths.ts` | `ensureMemoryDirExists`, `loadMemoryPrompt`, `getAutoMemPath` | filesystem, config, prompt text | 有旧 scaffold；新增契约 | REWRITE clean-room |
| Memory Tier | `src/memdir/memoryTypes.ts`, session/working messages in `query.ts` | `MEMORY_TYPES`, `MemoryType` | prompt taxonomy, markdown frontmatter | 不完整 | REWRITE as `MemoryTier` + `MemoryRecordStatus` |
| Context Budget | `src/services/compact/autoCompact.ts`, `src/query/tokenBudget.ts` | `calculateTokenWarningState`, `getAutoCompactThreshold`, `checkTokenBudget` | model context window, output reserve, env overrides | 无显式契约 | REWRITE as `ContextBudget` |
| Compression | `src/services/compact/compact.ts`, `autoCompact.ts`, `microCompact.ts`, `sessionMemoryCompact.ts` | `CompactionResult`, `compactConversation`, `autoCompactIfNeeded`, `microcompactMessages`, `trySessionMemoryCompaction` | LLM calls, messages, hooks, attachments, session memory | 旧 scaffold 不完整 | REWRITE request/result only |
| Memory Classification | `src/services/extractMemories/extractMemories.ts`, `src/memdir/findRelevantMemories.ts` | `executeExtractMemories`, `createAutoMemCanUseTool`, `findRelevantMemories` | forked agent, sideQuery, filesystem tools | 无底层契约 | REWRITE as `MemoryClassifier` contract |

## 8. CCX 符号和调用链

工具链：

```text
Tool / ToolDef / buildTool
  -> tools.ts getAllBaseTools()
  -> getTools(permissionContext)
  -> assembleToolPool(permissionContext, mcpTools)
  -> query.ts collects tool_use
  -> StreamingToolExecutor or runToolUse()
  -> inputSchema.safeParse()
  -> tool.validateInput()
  -> PreToolUse hooks / canUseTool / checkPermissions
  -> tool.call()
  -> mapToolResultToToolResultBlockParam()
  -> user tool_result message
```

记忆和检索链：

```text
memdir paths
  -> loadMemoryPrompt()
  -> MEMORY.md prompt entry
  -> scanMemoryFiles()
  -> formatMemoryManifest()
  -> findRelevantMemories()
  -> sideQuery selector
  -> relevant memory attachments
```

压缩链：

```text
query loop
  -> microcompactMessages()
  -> shouldAutoCompact()
  -> calculateTokenWarningState()
  -> autoCompactIfNeeded()
  -> trySessionMemoryCompaction()
  -> compactConversation()
  -> CompactionResult
  -> buildPostCompactMessages()
```

## 9. CCX 源文件到当前项目文件映射

| CCX 源文件 | 当前项目目标 | 分类 | 说明 |
| --- | --- | --- | --- |
| `src/Tool.ts` | `packages/ai-core/src/tools/types.ts` | SKIP | 当前项目已有更小安全契约 |
| `src/tools.ts` | `packages/ai-core/src/tools/registry.ts` | SKIP | 不复制函数式工具池 |
| `src/services/tools/toolExecution.ts` | `packages/ai-core/src/tools/runtime.ts` | SKIP | A504 已有公共 Runtime |
| `src/services/tools/StreamingToolExecutor.ts` | NOT MAPPED | SKIP | 强耦合 CCX streaming |
| `src/memdir/memoryTypes.ts` | `packages/ai-core/src/memory/contracts.ts` | REWRITE | 只重写项目所需分层/状态/来源 |
| `src/memdir/memoryScan.ts` | NOT MAPPED | SKIP | 不迁移文件型 memory dir |
| `src/memdir/findRelevantMemories.ts` | `packages/ai-core/src/memory/contracts.ts` | REWRITE | 只定义 `MemoryClassifier`/query 契约，不引入 sideQuery |
| `src/services/extractMemories/extractMemories.ts` | `packages/ai-core/src/memory/contracts.ts` | REWRITE | 只定义候选记忆和默认拒绝写入 |
| `src/services/compact/autoCompact.ts` | `packages/ai-core/src/memory/contracts.ts` | REWRITE | 只实现纯预算评估 |
| `src/services/compact/compact.ts` | `packages/ai-core/src/memory/contracts.ts` | REWRITE | 只定义压缩 request/result preview |
| `src/services/compact/microCompact.ts` | NOT MAPPED | SKIP | 不实现 tool result cache editing |
| `src/services/compact/sessionMemoryCompact.ts` | `packages/ai-core/src/memory/contracts.ts` | REWRITE | 只保留 preserve ids 概念 |

## 10. COPY / ADAPT / REWRITE / SKIP 分类

- COPY：无。
- ADAPT：无。
- REWRITE：`packages/ai-core/src/memory/contracts.ts`，基于本项目需求 clean-room 重写。
- SKIP：CCX 工具执行器、流式执行器、文件型 memdir、sideQuery 记忆检索、自动/手动完整压缩流程、session memory compact 执行流、LLM 摘要调用。

## 11. 当前项目已有 Tool Runtime 与 CCX 重复项

当前 `packages/ai-core/src/tools` 已覆盖：

- 工具定义。
- 工具注册。
- 工具执行入口。
- disabled-by-default。
- required permissions。
- confirmation required。
- input schema validation。
- safe error redaction。
- client `userId` stripping。

`packages/ai-core/src/agent-runtime/tools` 仍是独立 agent skeleton，但本轮没有继续扩展它，也没有让它成为包级工具入口。`@learning-agent-platform/ai-core/tools` 仍指向公共 `src/tools/index.ts`，A504+ 测试确认该入口不导出 `SkeletonAgentToolExecutor`。

## 12. 统一入口结论

- 公共工具入口保持 `packages/ai-core/src/tools`。
- A504+ 不建立第三套工具执行器。
- 记忆契约入口为 `packages/ai-core/src/memory/contracts.ts` 并通过 `packages/ai-core/src/memory/index.ts` 导出。
- `packages/ai-core/package.json` 已有 `./memory` 和 `./tools` 子路径映射，A504+ 测试校验它们指向真实源码文件。

## 13. 实际搬运的记忆基础契约

新增 clean-room 契约：

- `MemoryTier`: `long_term | working | short_term`
- `MemorySource`: `conversation | user_explicit | learning_report | review_plan | codeforces_profile | code_analysis`
- `MemoryRecordStatus`: `confirmed | candidate | ephemeral | readonly_context`
- `MemoryRecord`
- `MemoryCandidate`
- `MemoryStore`
- `MemoryQuery`
- `MemoryClassifier`
- `ContextBudget`
- `ContextBudgetResult`
- `CompressionReason`: `context_budget | user_requested | conversation_boundary`
- `CompressionRequest`
- `CompressionResult`
- `ContextCompressor`
- `authorizeMemoryWrite()`
- `evaluateContextBudget()`
- `createCompressionRequest()`
- `createPreviewCompressionResult()`

四类数据区分：

- 用户明确要求保存的长期记忆：`tier=long_term`, `status=confirmed`, `source=user_explicit`。
- 系统识别但未确认的候选：`status=candidate`。
- 当前会话短期记忆：`tier=short_term` 或 `tier=working`, `status=ephemeral`。
- 学习报告、复习计划、CF、代码分析：`status=readonly_context`，默认不可写入长期记忆。

## 14. 本轮没有实现的功能

- 没有自动压缩完整流程。
- 没有 token 到阈值后自动调用模型摘要。
- 没有用户自然语言触发压缩。
- 没有对话自动写入长期记忆。
- 没有数据库表或 Prisma 修改。
- 没有记忆管理 UI。
- 没有 `/ai` 页面接线。
- 没有学习报告、复习计划、Codeforces、代码分析真实 Tool。
- 没有 Orchestrator、多 Agent loop、真实 Provider 或真实 LLM 摘要。
- 没有 Agent 自主写数据库。

## 15. 后续自动压缩闭环建议

- 先把 `ContextBudgetResult.status === needs_compression` 接入 agent turn planner，只产生日志和提示，不调用 LLM。
- 增加压缩审计事件：sessionId、reason、sourceMessageIds、pre/post token estimate、modelInvoked。
- 后续单独任务实现 summary provider gate，默认 mock/disabled。
- 压缩成功后再引入 boundary + summary + preserved tail + attachments 的恢复顺序。

## 16. 后续用户手动压缩入口建议

- 手动入口只创建 `CompressionRequest`，必须显式 `reason=user_requested`。
- UI 或命令层先展示 preview-only 结果，不直接调用模型。
- 真实摘要必须单独加权限、日志、取消和 raw prompt/response 脱敏边界。

## 17. 后续业务上下文 Tool 设计建议

- 学习报告、复习计划、Codeforces 数据、代码分析历史应优先实现为只读 Tool/Adapter。
- Tool 返回摘要、来源 id、更新时间和最小字段，不把整份业务记录塞进长期记忆。
- 这些上下文进入 prompt 时使用 `MemoryRecordStatus.ReadonlyContext` 或后续 `ContextAttachment`，不当作 long-term memory 写入。

## 18. 测试结果

通过：

- `pnpm --filter @learning-agent-platform/ai-core typecheck`
- `node --test tests\a504-tools-runtime.test.mjs` - 8/8 pass
- `node --test tests\a504-plus-*.test.mjs` - 10/10 pass
- `node --input-type=module -e "import('@learning-agent-platform/ai-core/memory')..."` in `packages/ai-core` - pass，输出 `object long_term function`
- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm --filter @learning-agent-platform/desktop typecheck` - package script states no TypeScript yet and skips
- `pnpm --filter @learning-agent-platform/db typecheck`
- `pnpm --filter @learning-agent-platform/book-engine typecheck`
- `pnpm --filter @learning-agent-platform/learning-engine typecheck`
- `pnpm --filter @learning-agent-platform/shared typecheck`

根级：

- `pnpm run typecheck` 未进入 TypeScript，失败原因仍是 Windows bash 环境缺少 `/dev/stderr`：`tee: /dev/stderr: No such file or directory`。

Web 回归：

- 临时 dev server：`http://127.0.0.1:3105`
- `GET /ai` - 200
- `GET /user` - 200
- `GET /problems` - 200
- 临时进程已停止，`PORT_3105_STOPPED`。

## 19. 未执行和未验证项

- 未执行 Git add、commit、push。
- 未执行 Prisma migration。
- 未调用真实 LLM。
- 未执行真实外部 Tool。
- 未验证完整浏览器 hydration 日志；本轮只做 HTTP route smoke 和 typecheck。
- 未修复根级 `scripts/vm-typecheck.sh` 的 `/dev/stderr` 环境问题，因为它不是本轮改动引起。

## 20. 完成判定

A504+ 判定为完成：

- CCX 许可证缺失已明确记录。
- 实际读取 CCX 文件清单已列出。
- 实际符号和调用链已列出。
- 源文件到目标文件映射已列出。
- COPY/ADAPT/REWRITE/SKIP 已明确。
- 没有新增重复 Tool Runtime。
- 已建立记忆分层、来源、上下文预算和压缩请求的真实基础契约。
- `@learning-agent-platform/ai-core/memory` 在包自引用环境下可运行时导入。
- 新旧测试通过。
- package typecheck 通过。
- Web 回归无新增错误。
- 未启用真实 LLM，未修改 Prisma，未执行 Git 操作。
