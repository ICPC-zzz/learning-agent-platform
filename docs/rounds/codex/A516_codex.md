# A516 Codex Round

Date: 2026-06-28

## 截断前已完成内容

- A516 已存在 `tests/a516-*.test.mjs`，覆盖 Tool Result 预算、Artifact、安全过滤、microcompact、circuit breaker、Repository Artifact 隔离和 Web dev stub 主链。
- A516 已存在源码模块：
  - `packages/ai-core/src/agent-runtime/tool-result-context.ts`
  - `packages/ai-core/src/agent-runtime/reliable-agent-loop.ts`
  - `apps/web/src/lib/assistant/assistant-task-repository.ts`
  - `apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts`
- A515 Reliable Agent Loop 基础实现和任务事件持久化已保留。

## 本次续跑完成内容

- 审计工作区状态、现有 A515/A516 文档和 A516 测试。
- 运行 A515/A516 专项测试并确认截断前实现可运行。
- 修复用户可见英文文案：
  - 开发验收注入模式名改为中文。
  - Reliable Agent Loop 审计事件摘要改为中文。
  - 开发验收最终回答不再显示 `raw prompt/raw provider response/raw tool output` 字样。
- 完成浏览器 QA，使用真实 `/ai` 页面表单、真实 server action、Reliable Agent Loop、canonical Tool Runtime、Task Repository 和 Timeline。
- 补齐本轮状态文档和交接。

## 保留的已有改动

- 没有回滚或重做前序 A516 实现。
- 没有删除既有 A515/A516 测试。
- 没有修改已有 Prisma schema 或迁移。本轮开始时 Prisma schema 已处于未提交修改状态，但本轮未触碰。

## 修复的问题

- `AssistantChatPanel.tsx` 的 `formatStabilityMode()` 中多项开发注入模式原为英文，已改成中文。
- `reliable-agent-loop.ts` 中若干 `safeSummary` 和无效 Tool Call reason 原为英文，已改成中文。
- `assistant-multi-agent-runtime.ts` 中持久化任务事件 fallback 文案、Orchestrator 角色、开发注入错误摘要原为英文，已改成中文。
- 开发验收最终回答的安全说明改成中文，不再显示 raw 术语。

## R4/R5 浏览器结果

通过 `LAP_AGENT_STABILITY_TEST_MODE=1 pnpm dev -- --port 3106` 启动 Web 后完成以下场景：

- 正常多 Tool Agent Loop：通过，Repository 记录多次模型请求、Tool Result 回灌、microcompact、最终回答和 Evidence。
- Tool Result 回灌后的第二次模型请求：通过，`model_continuation_started` 持久化。
- 局部 Tool 失败：通过，`tool_internal_error_once` 返回 `partial_success`。
- 空结果：通过，`tool_empty_once` 持久化 empty 状态并继续生成回答。
- 未知 Tool：通过，`tool_call_validation_failed` 和安全 Tool Result 回灌持久化。
- 重复调用保护：通过，`tool_duplicate_once` 持久化 validation failure。
- maxTurns / maxToolCalls：通过，均持久化 limit reached。
- 取消：通过，取消后晚到结果未覆盖 `cancelled` 终态。
- 超时：通过，`tool_timeout_once` 持久化 timeout/partial_success。
- 刷新恢复：通过，最终回答和 Timeline 从 Repository 恢复。
- 自动折叠与重新展开：终态任务使用 existing `<details>` 呈现，刷新后仍可展开查看事件。
- 不支持 Tool Calling 兼容路径：通过，`tool_calling_unsupported` 走旧多 Agent 兼容路径，不写 Reliable Loop 事件。

## Tool Result Budget

- 小结果直接注入模型上下文。
- 大结果超过预算时替换为安全 Preview 与 Artifact 引用。
- 单结果、单轮、整轮预算由 `tool-result-context.ts` 集中处理。

## Artifact

- 大结果 Artifact 按 owner/run 隔离并记录安全元数据。
- `toAssistantTaskView()` 不暴露服务器文件路径。
- 过期清理会保留最终回答或证据仍引用的 Artifact。

## 敏感过滤

- 敏感 key 和敏感字符串会被 redacted。
- 检测到敏感内容时不持久化 Artifact，并设置 `sensitiveResultNotPersisted`。
- 测试覆盖 token、Authorization、DATABASE_URL 风格内容。

## microcompact

- 旧 Tool Result 可被 microcompact 为安全摘要。
- 最近 Tool Call/Result 配对和受保护 call id 保留。
- 取消、超时、权限拒绝等终态不会被压坏。

## preserved tail

- 最近消息和最近 Tool Result 保留。
- 当前待消费 Tool Result 通过 `protectToolCallIds` 保留，避免切断 assistant tool_calls 到 tool result 的配对。

## circuit breaker

- 压缩失败计数、最后失败时间和 circuit open 状态集中记录。
- 达到阈值后停止继续模型压缩，返回中文阻断提示。
- 成功压缩后失败计数重置。

## 无模型降级

- 无摘要模型时使用确定性结构化摘要。
- 无真实 Tool Calling 模型时，开发验收模式使用 dev stub provider，但仍通过 Web 主链、Reliable Agent Loop、canonical Tool Runtime 和 Repository。
- 不支持 Tool Calling 时进入明确兼容路径。

## 测试结果

通过：

```powershell
node --test tests/a515-*.test.mjs
node --test tests/a516-*.test.mjs
node --test tests/a512-*.test.mjs
node --test tests/a513-*.test.mjs
node --test tests/a514-*.test.mjs
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
npx eslint packages/ai-core/src/agent-runtime/reliable-agent-loop.ts packages/ai-core/src/agent-runtime/tool-result-context.ts apps/web/src/lib/assistant/assistant-task-repository.ts apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts apps/web/src/app/_components/AssistantChatPanel.tsx tests/a515-reliable-agent-loop.test.mjs tests/a515-assistant-task-repository-agent-loop-events.test.mjs tests/a516-assistant-task-artifact-repository.test.mjs tests/a516-reliable-agent-loop-context.test.mjs tests/a516-tool-result-context.test.mjs tests/a516-web-development-agent-loop-provider.test.mjs
```

A514 real Prisma test skipped safely because `LAP_ALLOW_REAL_DB_TESTS=1` was not set.

## 浏览器结果

- `/ai` HTTP 200 confirmed on port 3106.
- Browser form submission used real UI controls.
- Repository inspection confirmed persisted task events instead of frontend timer-only steps.
- Refresh recovery confirmed final answers and timeline persisted.

## 真实 DB 是否复验

否。本轮未设置 `LAP_ALLOW_REAL_DB_TESTS=1`，未运行真实 DB 写入复验，未执行 migration 或 `prisma db push`。

## 用户仍需复验

- 使用真实用户配置的 Tool Calling CHAT 模型完成一次手动 QA。
- 如需把权限拒绝也纳入 Reliable Loop 浏览器注入，需要单独修正 `tool_permission_denied_once` 的 Reliable Loop 注入路径并复验。

## 未完成或未验证

- 真实外部模型未调用。
- 真实 DB 未复验。
- Reliable Loop 浏览器权限拒绝注入未触发，当前只由 A512/A513 canonical runtime 测试覆盖。
