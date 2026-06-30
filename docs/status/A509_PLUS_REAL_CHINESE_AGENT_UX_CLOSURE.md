# A509+ 真实中文 Agent、长期记忆与执行链验收修复

## 范围

本轮修复 A509 后验收中暴露的三类问题：

- 显式长期记忆请求被 Codeforces 关键词误路由。
- A509 多步骤任务最终回答仍有英文调试词、空候选 fallback 不完整、执行链展开方式不符合验收。
- 结果聚合没有优先使用用户已配置启用的模型，未配置模型时也没有给出明确中文提示。

## 已完成

- 新增 `assistant-intent-resolver.ts`，在服务端统一按优先级识别意图：任务控制、长期记忆写入、长期记忆读取、会话管理、代码分析后续、Codeforces、普通聊天。
- 固定回归输入会被识别为 `MEMORY_WRITE`，规范化长期记忆为：当用户请求推荐 Codeforces 题目或询问后续刷题建议时，先提醒用户刷新学习分析报告和复习报告，再继续提供建议。
- `runAssistantAction` 对 `MEMORY_WRITE` 走同步闭环：追加用户消息、写入当前用户长期记忆、去重旧语义记忆、返回中文确认；不会调用训练画像或候选题工具。
- Codeforces 同步路径和 A509 多步骤聚合路径都会读取当前用户长期记忆，并在后续题目推荐或刷题建议前先提示刷新学习分析报告和复习报告。
- 个性化候选题加入四级 fallback：目标区间 + 薄弱标签、目标区间任意标签、上下放宽 100 Rating、有效本地题池中最接近目标 Rating。
- A509 最终回答聚合优先调用用户模型管理中配置并启用的默认 CHAT 模型；未配置可用模型时明确提示“尚未配置可用的 AI 模型，请先到模型管理中配置并启用模型。”
- 模型调用支持 `AbortSignal`，用户模型 endpoint 经过 SSRF baseUrl guard，当前 resolver 只接受 BEARER 模式，避免误用不支持的认证配置。
- `/ai` 执行链 UI 改为运行中显示“处理中 · 00:xx”，完成后默认折叠；最终回答放在主区域，依据和审计默认折叠。
- 用户可见工具名、步骤名、证据类型、审计事件、候选题摘要和常见 fallback 文案统一中文化。

## 验证

- `pnpm exec tsx --test ../../tests/a508-cf-personalized-agent.test.mjs ../../tests/a509-multi-agent-task.test.mjs ../../tests/a509-plus-real-agent-ux.test.mjs`：19 项通过。
- `pnpm --filter @learning-agent-platform/web typecheck`：通过。
- `pnpm --filter @learning-agent-platform/ai-core typecheck`：通过。
- `pnpm --filter @learning-agent-platform/db typecheck`：通过。
- `pnpm run typecheck`：通过，0 errors。

## 边界

- 本轮未新增 Prisma migration。
- 本轮未扩大任意工具执行权限；Codeforces 候选题仍只读本地精选题池，近期比赛仍只读 Codeforces 官方公开 API 或短期缓存。
- 用户模型调用只在用户已配置并启用默认 CHAT 模型时发生；未配置或不支持的 authMode 不会 mock 冒充真实模型。
- BEARER 之外的用户模型认证模式仍需后续单独实现适配器后再启用。
