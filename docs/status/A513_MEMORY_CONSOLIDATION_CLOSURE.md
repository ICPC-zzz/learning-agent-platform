# A513 Tool Runtime Acceptance and Memory Consolidation Closure

日期：2026-06-28

## 结论

A513 已完成两个 gated 阶段：

- A 阶段补齐 canonical Tool Runtime 浏览器验收注入，并确认 Web Assistant 可见工具失败状态仍来自 canonical runtime。
- B 阶段实现多轮后台长期记忆归纳闭环，不修改 Prisma schema，不执行迁移。

## 完成范围

### Canonical Tool Runtime 验收

- 新增 `tool_empty_once`、`tool_internal_error_once`、`tool_timeout_once`、`tool_cancel_once`、`tool_permission_denied_once`。
- 新增模式只在 `LAP_AGENT_STABILITY_TEST_MODE=1` 且非生产环境生效。
- A508 Codeforces 工具路径和普通 Web 工具路径都能接收同一 `stabilityInjectionMode`。
- internal error 注入包含故意的敏感诊断片段，测试确认最终消息和时间线安全摘要不泄漏该片段。

### 后台长期记忆归纳

- 会话 JSON cursor 记录后台归纳进度、失败计数、运行中状态和 trailing run。
- 普通对话完成后异步 queue 后台归纳；显式记忆写入会跳过后台归纳并推进 cursor。
- 单会话 single-flight：同一 conversation 正在归纳时，新触发只记录 trailing run，结束后最多再用最新上下文跑一次。
- 默认 8 个 user turn 触发；测试模式 2 个 user turn 触发。
- 默认无模型时不伪造成功，只记录 `skipped_model_unavailable`。
- 已配置 Assistant LLM provider 时才调用模型输出结构化候选。
- 候选写入前执行：
  - 置信度阈值
  - 敏感内容过滤
  - active 记忆指纹去重
  - deleted tombstone 防复活
  - user owner alias 隔离
  - targeted supersede
- Prompt/retrieval 只使用 active、非内部记忆。

### 删除和生命周期

- 长期记忆删除改为 tombstone，不物理删除：
  - 安全占位内容
  - `enabled=false`
  - `lifecycleStatus=deleted`
  - `metadata.tombstone.contentFingerprint`
- 内部 session summary 仍可物理删除，避免摘要滚动不断占用长期记忆配额。
- 支持 `active`、`archived`、`superseded`、`deleted`，并兼容旧 `historical`。

## 验收

自动化通过：

- `node --test tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a512-agent-tool-adapter.test.mjs tests/a513-tool-runtime-browser-injection.test.mjs`
- `node --test tests/a513-background-memory-consolidation.test.mjs`
- `node --test tests/a504-tools-runtime.test.mjs tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a512-agent-tool-adapter.test.mjs tests/a513-tool-runtime-browser-injection.test.mjs tests/a513-background-memory-consolidation.test.mjs`
- `npm run lint`
- `npm run typecheck`

浏览器通过：

- `/ai` 页面 runtime config 显示新增 5 个工具故障模式。
- `tool_permission_denied_once` + `近期 Codeforces 比赛` 显示 canonical 权限拒绝时间线。
- 安全摘要显示未保存原始响应。

## 未做

- 未改 Prisma schema。
- 未执行迁移。
- 未执行任何 git add/commit/push/reset/restore/stash/clean。
- 未接入生产级 Agent 自主执行。
- 未让社区 Skill 自动执行。
- 未在无模型时使用 mock 候选伪造后台记忆归纳成功。

## 后续建议

- 给后台记忆归纳增加可视化状态入口，展示最近一次 `succeeded/skipped/failed/circuit_open`。
- 将模型候选 provider 的 JSON schema 和 prompt 进一步收敛到单独模块，便于后续替换 provider。
- 在真实数据库环境补一组 Prisma integration 测试，验证 tombstone 与 owner alias 查询在真实 client 上的行为。
