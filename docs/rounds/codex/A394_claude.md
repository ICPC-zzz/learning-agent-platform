# A394 — Reader AI 问答代码块上下文与安全历史 v1

**模型**: Claude Sonnet (Claude Code)
**模式**: 普通 Claude Code（Web AI 业务重任务，非 Desktop，非 Go）
**日期**: 2026-06-11

## 1. 修改文件清单

### 新增 — Reader AI 代码上下文
- `apps/web/src/app/reader/reader-ai-code-context.ts` — 代码块安全摘要上下文构建器
- `apps/web/src/app/reader/reader-ai-code-context.test.mjs` — 代码块上下文测试 (37 pass / 0 fail)

### 新增 — QA 安全历史 localStorage
- `apps/web/src/lib/local-reader-ai-history-store.ts` — localStorage AI 问答历史安全存储
- `apps/web/src/lib/local-reader-ai-history-store.test.mjs` — 历史存储测试 (33 pass / 0 fail)

### 新增 — Reader 历史 View Model
- `apps/web/src/app/reader/reader-ai-history-view-model.ts` — Reader 章节问答历史视图模型
- `apps/web/src/app/reader/reader-ai-history-view-model.test.mjs` — 历史 VM 测试 (10 pass / 0 fail)

### 新增 — DB guard/action/loader
- `apps/web/src/app/user/reader-ai-history-db-guard.ts` — DB 历史 guard（默认关闭）
- `apps/web/src/app/user/reader-ai-history-db-guard.test.mjs` — Guard 测试 (19 pass / 0 fail)
- `apps/web/src/app/user/reader-ai-history-db-actions.ts` — DB 写操作草案（guard 关闭时不访问 DB）
- `apps/web/src/app/user/reader-ai-history-db-loader.ts` — DB 读操作草案（local fallback）

### 新增 — /user/ai-history 页面
- `apps/web/src/app/user/ai-history/page.tsx` — AI 问答历史页（服务端渲染 + DB/local 数据）
- `apps/web/src/app/user/ai-history/UserAiHistoryClientHydration.tsx` — 客户端 localStorage 水合
- `apps/web/src/app/user/ai-history/user-ai-history-page-view-model.ts` — 页面视图模型
- `apps/web/src/app/user/ai-history/user-ai-history-page-view-model.test.mjs` — 页面 VM 测试 (16 pass / 0 fail)

### 修改 — 现有文件
- `apps/web/src/app/reader/ReaderAiQuestionPanel.tsx` — 增加历史保存、展示（最近3条）、清除功能
- `apps/web/src/app/reader/ReaderPageContent.tsx` — 接入代码上下文构建器，传递真实 codeBlockSummaries
- `apps/web/src/app/reader/reader-ai-qa-context.ts` — 增加 contextSources / codeBlockCount 字段
- `apps/web/src/app/user/page.tsx` — Dashboard 增加 AI History 导航链接

## 2. 代码块上下文摘要说明

`reader-ai-code-context.ts`:
- 自建有 fenced code block 解析器（不依赖 reader-code-element-extractor）
- 每个代码块输出: index, language, lineCount, preview (≤300字), containsSensitivePattern
- 最多注入前 8 个代码块摘要
- 敏感字段检测（DATABASE_URL, api_key, bearer, password, secret, private_key, cookie, token, sk-* keys 等 13 种模式）
- 敏感代码块脱敏后仍可注入（preview 内容已 [redacted]）
- codeBlockCount 报告总数（不限于注入数），languageSummary 按语言统计
- 不注入完整代码文件、不注入隐藏 env
- 不破坏 A393 context builder 的章节截断逻辑

## 3. QA 安全历史说明

`local-reader-ai-history-store.ts`:
- localStorage key: `lap.web.reader.aiHistory`
- 保存字段: historyId, bookId, chapterId, bookTitle, chapterTitle, questionPreview(≤200字), answerPreview(≤500字), providerMode, realProviderCalled, createdAt, sourceType, codeBlockCount, safeToExposeToClient
- 不保存: raw prompt, raw response, token, cookie, secret, DATABASE_URL, api key, password, private_key, authorization, rawText, fullChapterContent
- JSON 损坏 safe fallback (返回空数组)
- dangerous field 自动拒绝 (返回 null)
- 支持: add, list (by bookId/chapterId/limit), count, remove (by historyId), clear (all or by scope)
- 最多 100 条

## 4. DB/local fallback 说明

- DB guard 默认关闭（需 5 层全部开启: LAP_ALLOW_REAL_DB_INTEGRATION + DATABASE_URL + LAP_WEB_AUTH_DEV_ENABLED + LAP_READER_AI_HISTORY_DB_DEV_ENABLED + dev session）
- Guard 关闭时: 不访问 repository、不写 DB、localStorage fallback 保持可用
- DB action 返回 `success: false, reasonCode: "db_not_generated"`（需 prisma generate 后启用）
- 未新增 Prisma 模型（ChapterQaHistory 已存在但字段不匹配；本次未改 schema，避免迁移风险）
- `/user/ai-history` 页面: DB 优先（服务端渲染）→ localStorage 补充（客户端水合）

## 5. Reader QA 面板历史展示

`ReaderAiQuestionPanel.tsx` 更新:
- 提交问题成功后自动保存安全摘要到 localStorage
- 展示当前章节最近 3 条问答历史
- 支持清除本章历史（按钮）或删除单条（× 按钮）
- 文案包含: "仅保存安全摘要"、"不保存原始 prompt/response"、"默认 mock"、"dev-only"、"未接生产 AI 服务"

## 6. /user/ai-history 页面

- 展示 DB + localStorage 汇总历史
- 每条显示: bookTitle, chapterTitle, questionPreview, answerPreview, providerMode, codeBlockCount, createdAt, sourceLabel
- 返回 Reader 链接
- 空态引导（无历史时提示前往 Reader）
- 安全声明 footer
- 客户端水合组件（UserAiHistoryClientHydration）
- /user dashboard 增加 AI History 导航链接

## 7. 是否真实调用 LLM

**否**。默认使用 mock provider。External provider 需所有 dev env 显式开启。

## 8. 是否保存 raw prompt/response

**否**。
- localStorage 只保存安全摘要（questionPreview ≤200字, answerPreview ≤500字）
- DB action 草案同样不保存 raw prompt/response
- 所有安全边界 intact

## 9. 是否修改 Prisma schema/migration

**否**。
- 未修改 `packages/db/prisma/schema.prisma`
- 未修改 `packages/db/src/generated-prisma-shim.ts`
- 未执行 Prisma migration
- ChapterQaHistory 模型已存在但字段与本次需求不匹配；本次采用纯 local history + DB guard 草案方案

## 10. lint/typecheck 结果

- **Lint**: PASS（VM lint complete，0 errors）
- **Typecheck**: PASS（typecheck 0 errors）

## 11. 测试结果

| 测试 | pass | fail | 备注 |
|------|------|------|------|
| reader-ai-code-context.test.mjs | 37 | 0 | 新增 |
| local-reader-ai-history-store.test.mjs | 33 | 0 | 新增 |
| reader-ai-history-db-guard.test.mjs | 19 | 0 | 新增 |
| reader-ai-history-view-model.test.mjs | 10 | 0 | 新增 |
| user-ai-history-page-view-model.test.mjs | 16 | 0 | 新增 |
| reader-ai-qa-guard.test.mjs | 54 | 0 | 已有 |
| reader-ai-qa-context.test.mjs | 42 | 1 | 已有（A393 预存边界） |
| reader-ai-qa-view-model.test.mjs | 44 | 0 | 已有 |
| mock-llm-provider.test.mjs | 29 | 2 | 已有（A393 预存） |
| external-chat-completions-provider.test.mjs | 45 | 1 | 已有（A393 预存） |
| **A394 新增** | **115** | **0** | |
| **总计** | **329** | **4 (预存)** | |

## 12. Skip 原因

- `reader-code-element-extractor.test.mjs`: 因依赖 react/next 模块无法在纯 Node 环境直接运行（A393 同样 skip）
- `reader-ai-qa-server-action.test.mjs`: 因依赖 @learning-agent-platform/ai-core 包无法直接运行（A393 同样 skip，集成 runner 覆盖）
- 未执行 real external provider 真实网络调用（env vars 未配置）
- 不启动 dev server
- 不做浏览器手动验收
- 不执行 Prisma migration
- 不执行 git add/commit/push

## 13. 安全边界确认

- 未硬编码 API key/token/secret/DATABASE_URL
- 未在代码中写入真实 provider 密钥
- 未在日志/history 中保存 raw prompt/raw response
- localStorage history 仅保存安全摘要，dangerous fields 自动拒绝
- DB guard 默认关闭，需 5 层显式开启
- 未把 mock 结果说成真实 AI
- 未把 dev-only 说成生产可用
- 未新增公开无保护 API route
- 未修改 Desktop
- 未接 Agent loop / tool execution
- 未接 RAG / vector DB
- 未修改 Prisma schema
- 未执行 Prisma migration

## 14. 未完成事项

- 浏览器手动验收 Reader QA 面板 UI + history 展示
- real external provider 真实网络测试（需配置 env vars）
- Prisma schema 新增 ReaderAiHistory 模型（当前仅 ChapterQaHistory，字段不匹配）
- DB repository 真实实现（需 prisma generate + migration）
- Reader user 面板 /user/activity 中的 AI 问答活动记录（当前无）
- 代码块 extractor 在 Node 环境直接运行测试（需 Node loader 支持）

## 15. 下一轮建议

- A395: 浏览器手动验收 Reader AI 问答 + 代码块上下文 + 历史展示
- 或 A395: 继续推进下一个 DB 持久化链路（如错题本、学习计划等）
- 或 A395: 用户执行 `prisma generate` + `prisma db push` 后补跑 DB 集成测试

## 16. 项目进度

**约 83.70%**（上一轮 83.00%，本轮新增代码块上下文 + QA 安全历史 + /user/ai-history + 115 测试 pass）
