# A513 Codex Round

日期：2026-06-28

## 任务

本轮按用户附件要求分两阶段完成：

1. A 阶段：补全 A512 canonical Tool Runtime 的浏览器验收能力，确认 Web Assistant 工具失败状态不绕过 canonical runtime。
2. B 阶段：在不修改 Prisma schema 的前提下，实现多轮后台长期记忆归纳闭环。

## A 阶段结论

A512 gate 通过后才进入 B 阶段。

- 普通 Web Assistant 工具路径和 A508 Codeforces 工具路径都继续通过 `executeAssistantToolWithCanonicalResult()` 进入 canonical runtime。
- 新增开发验收注入模式：
  - `tool_empty_once`
  - `tool_internal_error_once`
  - `tool_timeout_once`
  - `tool_cancel_once`
  - `tool_permission_denied_once`
- 注入仅在非生产环境且 `LAP_AGENT_STABILITY_TEST_MODE=1` 时生效。
- 浏览器 `/ai` runtime config 已暴露新增模式。
- 浏览器实测 `tool_permission_denied_once` 后，工具时间线显示 Codeforces 工具为无权限，安全摘要显示未保存原始响应。

## B 阶段实现

- `FileAssistantConversationRepository` 增加 `memoryConsolidation` cursor：
  - `lastConsolidatedMessageId`
  - `lastAttemptedMessageId`
  - `pendingTrailingRun`
  - `runningTaskId`
  - `consecutiveFailureCount`
  - `trailingRunCount`
  - `explicitWriteMessageIds`
- `memory-service.ts` 增加后台长期记忆归纳：
  - 默认 8 个 user turn 后触发；`LAP_MEMORY_CONSOLIDATION_TEST_MODE=1` 时 2 个 user turn 后触发。
  - 同一用户同一会话单飞运行；运行中再次触发只记录 trailing run。
  - 显式长期记忆写入会推进 cursor 并跳过后台归纳，避免重复抽取。
  - 无可用模型 provider 时只记录 `skipped_model_unavailable`，不伪造成功。
  - 已配置 Assistant LLM provider 时才调用真实 LLM 生成结构化候选。
  - 候选写入前执行敏感词过滤、置信度阈值、active 去重、deleted tombstone 防复活。
  - 支持 `superseded` 生命周期：旧记忆禁用并标记 superseded，新候选作为 active 记忆写入。
- `PrismaMemoryRepository.deleteMemory()` 对长期记忆改为 tombstone：
  - `enabled=false`
  - `lifecycleStatus=deleted`
  - `metadata.tombstone.contentFingerprint`
  - 内容替换为安全占位文本
  - 内部 session summary 仍允许物理删除，避免摘要滚动导致配额膨胀。
- 会话归档时相关记忆标记为 `archived`，恢复时回到 `active`。
- Prompt/retrieval 只使用 active 且非内部的记忆；deleted/superseded/archived 不进入回答上下文。

## 参考项目读取

仅按用户明确允许范围读取了 CCX 三个文件：

- `E:\code\ccx\src\services\extractMemories\extractMemories.ts`
- `E:\code\ccx\src\services\extractMemories\prompts.ts`
- `E:\code\ccx\src\memdir\memoryTypes.ts`

未复制参考项目代码，只提炼了 cursor、single-flight、trailing run、tombstone、防复活和安全 prompt 思路。

## 验证

通过：

- `node --test tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a512-agent-tool-adapter.test.mjs tests/a513-tool-runtime-browser-injection.test.mjs`
- `node --test tests/a513-background-memory-consolidation.test.mjs`
- `node --test tests/a504-tools-runtime.test.mjs tests/a508-cf-personalized-agent.test.mjs tests/a509-multi-agent-task.test.mjs tests/a512-canonical-tool-runtime.test.mjs tests/a512-web-tool-adapter.test.mjs tests/a512-agent-tool-adapter.test.mjs tests/a513-tool-runtime-browser-injection.test.mjs tests/a513-background-memory-consolidation.test.mjs`
- `npm run lint`
- `npm run typecheck`

浏览器验收：

- 启动：`LAP_AGENT_STABILITY_TEST_MODE=1`, `PORT=3000`, `npm run dev`
- 地址：`http://localhost:3000/ai`
- 验收结果：开发注入下拉包含 5 个新增工具故障模式；提交 `近期 Codeforces 比赛` 且选择 `tool_permission_denied_once` 后，工具时间线显示无权限，未保存原始响应。

## 边界

- 未修改 Prisma schema。
- 未生成或执行迁移。
- 未执行 `git add`、commit、push、reset、restore、stash、clean。
- 未把社区 Skill 或写工具设为默认自动执行。
- 未在无模型配置时伪造后台记忆归纳成功。
- 用户请求中的 `docs/status/A511_AGENT_IMPLEMENTATION_MASTER_PLAN.md` 和 `docs/status/A511_AGENT_ROUND_ROADMAP.md` 在当前仓库中不存在，本轮未创建伪造历史文档。
