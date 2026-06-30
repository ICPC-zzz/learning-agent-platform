# A512 Canonical Tool Runtime Closure

日期：2026-06-28

## 结论

A512 已完成统一 Tool 执行入口闭环。`packages/ai-core/src/tools` 现在是 canonical Tool Runtime，Web Assistant 和 `agent-runtime/tools` 都通过 adapter 进入同一套解析、校验、权限、超时、取消、安全摘要和审计流程。

## 已完成

- 在 `packages/ai-core/src/tools` 扩展 canonical 类型：`ToolExecutionStatus`、`ToolRiskCategory`、`ToolExecutionResult`、`ToolAuditEvent`、`ToolExecutionRequest`。
- `InMemoryToolRuntime.executeTool()` 统一处理工具查找、JSON schema 校验、自定义输入校验、权限判断、确认判断、child AbortController、timeout、cancel、empty result 和异常安全摘要。
- 所有用户可见失败摘要使用安全中文文案，不向 legacy `callTool()` 返回 Prisma、FK、stack、token、secret、provider 原始异常。
- 审计事件覆盖 `tool_registered`、`tool_resolved`、`tool_validation_failed`、`tool_permission_denied`、`tool_started`、`tool_succeeded`、`tool_empty`、`tool_timed_out`、`tool_cancelled`、`tool_failed`、`tool_result_returned`。
- Web Assistant 工具通过 `executeAssistantToolWithCanonicalResult()` 进入 canonical runtime；旧 `executeAssistantTool()` 保持兼容。
- Web 工具时间线支持 `empty`、`timed_out`、`permission_denied`、`cancelled`、`failed`、`skipped`，并展示 duration、cache、retryable。
- `agent-runtime/tools` 的 `SkeletonAgentToolExecutor` 改为 adapter，不再独立执行一套工具逻辑。
- `@learning-agent-platform/ai-core/model-gateway` 增加 package export，避免 assistant runtime 测试链路加载根 barrel。

## 未做

- 未修改 Prisma schema。
- 未生成或执行迁移。
- 未执行 `git add`、commit、push、reset、restore、stash、clean。
- 未接入真实写工具或社区 Skill 自动执行。

## 验证

- `node --test tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a512-agent-tool-adapter.test.mjs`
- `node --test tests/a504-tools-runtime.test.mjs tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs`
- `npm -w @learning-agent-platform/ai-core run typecheck`
- `npm -w @learning-agent-platform/web run typecheck`
- Browser smoke：`http://localhost:3000/ai` 可正常渲染，助手/记忆/工具相关文案可见，控制台 error 日志为空。

Lint 状态：

- 已尝试 `npm -w @learning-agent-platform/ai-core run lint` 和 `npm -w @learning-agent-platform/web run lint`。
- 结果未通过，原因是仓库既有全量 lint backlog，包括大量测试文件 `console/process/Buffer` 全局配置问题、未使用变量、`no-var`、`no-useless-escape` 等。
- A512 不扩大处理历史 lint 面；本轮以类型检查、专项测试、回归测试和浏览器 smoke 作为收口验证。

## 下一步建议

- A513 可继续做模型驱动 Tool Loop：让模型输出 tool call plan，但仍强制经过 canonical runtime。
- 继续保持只读工具优先；任何写工具必须先补确认、权限、审计和回滚边界。
