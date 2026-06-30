# A512 Codex Round

日期：2026-06-28

## 任务

统一 Tool 执行入口与安全失败回灌闭环。目标是把 Tool definition、registry、executor 收敛到 `packages/ai-core/src/tools`，让 Web Assistant 和 `agent-runtime/tools` 通过 adapter 进入同一套 runtime。

## 实现摘要

- 扩展 canonical Tool 类型和 runtime：
  - `ToolExecutionStatus`: `succeeded`、`empty`、`invalid_input`、`permission_denied`、`timed_out`、`cancelled`、`failed`。
  - `ToolRiskCategory`: `read_only`、`write_with_confirmation`、`forbidden`。
  - `ToolExecutionResult` 增加安全摘要、source refs、duration、cache、retryable。
  - `ToolAuditEvent` 增加完整工具生命周期事件。
- `InMemoryToolRuntime.executeTool()` 成为统一执行入口：
  - registry lookup
  - schema/custom validation
  - permission/confirmation
  - child AbortController
  - timeout/cancel
  - empty result 分类
  - 安全中文失败摘要
  - audit event sink
- Web Assistant 工具：
  - 新增 `executeAssistantToolWithCanonicalResult()`。
  - 旧 `executeAssistantTool()` 保持旧返回类型兼容。
  - 工具时间线展示 canonical status、duration、cache、retryable。
- Agent Runtime 工具：
  - `SkeletonAgentToolExecutor` 改为 adapter。
  - 旧事件与旧 `ToolExecutionStatus` 继续向外兼容。
  - 实际执行、超时、取消、异常摘要由 canonical runtime 处理。
- 文档与 package 边界：
  - 新增 `@learning-agent-platform/ai-core/model-gateway` package export。
  - `user-model-resolver` 改用 model-gateway 子路径，避免测试链路加载根 barrel。

## 测试

新增：

- `tests/a512-canonical-tool-runtime.test.mjs`
- `tests/a512-web-tool-adapter.test.mjs`
- `tests/a512-agent-tool-adapter.test.mjs`

通过：

- `node --test tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a512-agent-tool-adapter.test.mjs`
- `node --test tests/a504-tools-runtime.test.mjs tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs`
- `npm -w @learning-agent-platform/ai-core run typecheck`
- `npm -w @learning-agent-platform/web run typecheck`
- Browser smoke：`/ai` 页面可渲染，控制台无 error。

Lint：

- 已尝试 `npm -w @learning-agent-platform/ai-core run lint` 和 `npm -w @learning-agent-platform/web run lint`。
- 两者均未通过，失败来自仓库既有大范围 lint backlog；本轮未展开历史 lint 清理。

## 边界

- 未修改 Prisma schema。
- 未执行迁移。
- 未执行 Git add/commit/push/reset/restore/stash/clean。
- 未把社区 Skill 或写工具设为默认自动执行。
