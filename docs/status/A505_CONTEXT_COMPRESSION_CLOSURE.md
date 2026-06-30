# A505 /ai 会话上下文压缩闭环报告

Date: 2026-06-27

## 1. 结论

A505 已把 `/ai` 会话上下文压缩从 A504+ 的底层契约推进到一个可运行闭环：

- `/ai` 会话消息改为服务端开发态持久化。
- 页面刷新后可以恢复同一开发用户的会话。
- 支持按钮手动压缩。
- 支持自然语言显式命令压缩，例如“请压缩当前上下文”。
- 支持达到上下文预算阈值后的自动压缩。
- UI 展示当前上下文 token 估算、窗口、状态、压缩次数、归档消息数和最近压缩摘要。
- 压缩后可以继续对话。

本轮仍然不调用真实 LLM provider，不执行真实工具，不新增 Prisma schema，不做 Git add / commit / push。

## 2. 范围

本轮只处理 `/ai` 会话上下文压缩闭环 v1。

允许修改范围：

- `packages/ai-core/src/memory/**`
- `apps/web/src/lib/assistant/**`
- `apps/web/src/app/_components/Assistant*.tsx`
- A505 测试文件
- A505 状态与交接文档

未读取参考项目源码。用户已澄清 `E:\code\ccx` 是学校工作室继承项目，可以按实际需要复用源码；但 A505 的实现没有依赖 CCX 代码。

## 3. 主要代码变更

新增：

- `packages/ai-core/src/memory/a505-context-compression.ts`
- `apps/web/src/lib/assistant/assistant-conversation-repository.ts`
- `tests/a505-context-compression.test.mjs`
- `tests/a505-conversation-repository.test.mjs`

更新：

- `packages/ai-core/src/memory/index.ts`
- `apps/web/src/lib/assistant/assistant-types.ts`
- `apps/web/src/lib/assistant/assistant-server-actions.ts`
- `apps/web/src/lib/assistant/memory-service.ts`
- `apps/web/src/app/_components/AssistantConversationStore.tsx`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`

## 4. 服务端会话持久化

A505 新增开发态文件仓库：

```text
.codex_tmp/a505-assistant-conversations/<safe-user-id>.json
```

行为：

- 服务端通过现有 dev session 读取可信用户身份。
- 客户端不再传入权威 `userId`。
- 每个开发用户一个 JSON 会话文件。
- 写入采用临时文件 + rename 的原子替换方式。
- 旧消息不会删除，而是标记为 `archivedByCompressionId`。
- 前端 localStorage 不再保存权威消息列表，只缓存会话 id、草稿和状态。

该仓库仅用于本地开发闭环，不是生产存储方案。

## 5. 压缩触发方式

手动按钮：

- `/ai` 页面右侧上下文卡片提供“压缩”按钮。
- 成功后追加一条 system 事件。

显式命令：

- 输入包含“压缩当前上下文”“总结当前上下文”“compact context”等意图时触发压缩。
- 命令本身不生成普通 assistant 回复，只生成 system 压缩事件。

自动压缩：

- 当活跃上下文 token 估算超过压缩阈值时触发。
- 如果可压缩消息不足，允许本轮继续，不阻断用户发送。
- 压缩后保留最近消息，归档较早消息。

## 6. 上下文预算

默认窗口：

```text
4096 tokens
```

开发态覆盖：

```text
LAP_AI_CONTEXT_WINDOW_TOKENS
```

阈值：

- `normal`：低于 70%
- `warning`：达到 70%
- `shouldCompress`：达到 85%
- `blocking`：达到 95%

token 估算是本地启发式：

- CJK 字符约按 0.8 token 估算。
- 非 CJK 文本约按 4 字符 1 token 估算。
- 不等同于真实模型 tokenizer。

## 7. 压缩摘要格式

压缩器为本地确定性结构化压缩器 v1，输出：

- 用户目标
- 已确认事实
- 约束条件
- 已做决定
- 待办事项
- 需避免内容
- 最近会话状态

为避免摘要越压越长，真正写入活跃上下文的 `summaryText` 是紧凑版摘要，不包含“最近会话状态”的完整复述。完整结构仍保存在 compression record 中，供 UI 展示。

## 8. 活跃上下文构造

活跃上下文由以下内容组成：

1. 未归档消息。
2. 最近一次压缩摘要。
3. 会话压缩元数据。

压缩时：

- 较早消息被归档。
- 最近 2 条消息默认保留。
- 压缩记录持久化。
- 后续发送消息会基于压缩摘要 + 当前活跃消息继续。

## 9. `/ai` UI 行为

新增上下文状态卡片：

- 估算 token 数。
- 上下文窗口。
- 使用比例。
- 状态：正常 / 接近阈值 / 建议压缩 / 已到阻断区。
- 压缩次数。
- 归档消息数。
- 最近压缩时间。
- 压缩前后 token 估算。
- 最近压缩原因。
- 压缩摘要分组。

system 事件会在消息流中展示，用于说明手动或自动压缩已经发生。

## 10. 记忆写入边界

本轮没有开启长期记忆自动写入。

`persistAssistantMemoryTurn()` 不再自动把候选写入长期记忆，只保留现有会话摘要路径。A504+ 的长期记忆授权边界仍然成立：未经用户确认和权限允许，不写长期记忆。

## 11. 浏览器验证

临时 dev server 使用：

```text
http://localhost:3000
```

验证路径：

- 使用开发用户 `dev-user-001` 登录。
- 打开 `/ai`。
- 发送多轮消息。
- 点击手动压缩。
- 刷新页面后确认压缩摘要和计数仍存在。
- 压缩后继续发送消息，确认会话仍可用。
- 输入“请压缩当前上下文”触发显式命令压缩。
- 用较小 `LAP_AI_CONTEXT_WINDOW_TOKENS=900` 触发自动压缩。

观察结果：

- 手动压缩后 UI 显示 `压缩前 368 -> 压缩后 281` 一类下降结果。
- 显式命令压缩只生成 system 事件，不生成普通 assistant 回复。
- 自动压缩可连续触发，未出现前端循环阻塞。
- 刷新恢复和压缩后继续对话通过浏览器验证。

## 12. 自动化测试

新增 A505 测试覆盖：

- token 预算状态。
- 显式压缩命令识别。
- 敏感字段脱敏。
- 本地结构化摘要。
- 上下文压缩前后下降。
- 服务端文件仓库创建、追加、恢复、压缩和归档。

同时保留 A504 / A504+ 回归。

实际验证结果：

- `pnpm --filter @learning-agent-platform/ai-core typecheck` - PASS
- `pnpm --filter @learning-agent-platform/web typecheck` - PASS
- `node --test tests/a504-tools-runtime.test.mjs` - PASS
- `node --test tests/a504-plus-memory-contracts.test.mjs` - PASS
- `node --test tests/a505-*.test.mjs` - PASS
- `pnpm run typecheck` - PASS after A505+ script compatibility repair.

## 13. 没有实现

- 没有真实 LLM 摘要。
- 没有真实 provider 调用。
- 没有真实 Agent loop。
- 没有真实工具执行。
- 没有 Prisma schema 或迁移。
- 没有生产级会话存储。
- 没有多设备同步。
- 没有把压缩摘要写入长期记忆。
- 没有 Git add / commit / push。

## 14. 已知限制

- token 估算不是模型 tokenizer，只用于本地预算演示。
- 压缩摘要是确定性启发式摘要，质量不等同于 LLM 摘要。
- 文件仓库只适合开发态，不适合并发生产服务。
- 历史消息归档仍保存在本地 JSON 中，未做加密或清理策略。
- UI 当前显示的是 A505 会话压缩状态，不代表完整 AI Agent 上线。

## 15. 运行方式

开发环境示例：

```powershell
$env:LAP_WEB_AUTH_DEV_ENABLED="true"
$env:LAP_AI_CONTEXT_WINDOW_TOKENS="900"
pnpm dev
```

访问：

```text
http://localhost:3000/login
http://localhost:3000/ai
```

## 16. 下一步建议

下一轮建议只选一个小目标：

- 把 A505 文件仓库抽象成可替换 repository contract，为后续 Prisma 持久化做准备。
- 或引入真实 tokenizer 适配层，但仍不接真实 provider。
- 或单独做 `/ai` 压缩摘要的 UX 打磨和空状态优化。
