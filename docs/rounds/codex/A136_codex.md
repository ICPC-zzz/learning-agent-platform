# A136 Codex

## 1. 本轮任务

补齐 A135 可靠性验证：修复阻塞 `pnpm typecheck` / `pnpm lint` 的既有语法与类型错误，并在本地数据库可用时验证 reader progress 刷新恢复。

## 2. 完成内容

- 修复 `apps/web/src/app/agent/page.tsx` 中误写为中文字段名、全角冒号或含空格属性访问的语法/类型错误。
- 修复 lint 明确报出的 ai-core 未使用符号问题。
- 保持 `/agent` preview-only / mock-only / disabled-by-default 语义，未接入真实 provider、真实工具执行或真实 Agent loop。
- 检查 reader progress 恢复路径；未修改 A135 reader progress 业务设计。
- 启动本地 Web 并用浏览器确认无数据库时 `/books` 与 `/reader?bookId=sample-programming-fundamentals` fallback 路径可访问，页面明确显示只读 fallback 进度状态。

## 3. 新增文件

- `docs/rounds/codex/A136_codex.md`

## 4. 修改文件

- `apps/web/src/app/agent/page.tsx`
- `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts`
- `packages/ai-core/src/agent/runtime-policy-preview.ts`
- `packages/ai-core/src/llm-provider-config.ts`
- `packages/ai-core/src/spark-provider.ts`
- `docs/codex-context/CURRENT_HANDOFF.md`

## 5. 删除文件

无。本轮未删除文件。

注意：开始前工作区已存在 `docs/status/WEB_MVP_COMPLETION_ROADMAP.md` 的删除状态，本轮未创建、删除或恢复该文件。

## 6. 移动文件

无。

## 7. 静态校验错误与修复说明

- 初始 `pnpm typecheck` 失败于 `apps/web/src/app/agent/page.tsx`：
  - 多处 `TS1127 Invalid character`，原因是对象属性写成 `类别：`。
  - 多处 `TS1005 ',' expected`，原因是 JSX/TS 属性访问写成含空格的中文字段，例如 `preview.skillReadiness.匹配 Skill 数量`。
- 初始 `pnpm lint` 失败于：
  - `apps/web/src/app/agent/page.tsx` 解析错误。
  - `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts` 未使用 type import。
  - `packages/ai-core/src/agent/runtime-policy-preview.ts` 未使用值导入。
  - `packages/ai-core/src/llm-provider-config.ts` 未使用常量。
  - `packages/ai-core/src/spark-provider.ts` 未使用参数。
- 已修复 A136 允许范围内的 `/agent` 与 ai-core 阻塞。
- 复跑后 `pnpm lint` 通过。
- 复跑后 `pnpm typecheck` 继续失败，但剩余错误在本轮禁止修改范围：
  - `apps/web/src/app/books/book-detail-loader.ts(161,3)`
  - `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx(218,4)`
  - `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx(220,10)`
  - `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx(222,10)`

## 8. reader progress 验证说明

- 当前 shell 环境检查结果：`DATABASE_URL=missing`。
- 因缺少 `DATABASE_URL`，无法完成真实数据库保存后刷新恢复端到端验收，未伪造通过。
- 已执行替代验证：
  - 阅读 `apps/web/src/app/reader/page.tsx`、`apps/web/src/lib/reader-progress.ts`、`packages/db` reading progress repository/mapper/export。
  - 确认 `loadLatestReaderProgressChapterId` 仅在 database source 且 `DATABASE_URL` 存在时读取 demo 用户最近进度，并校验章节属于当前书籍。
  - 启动本地 Web，浏览器打开 `/books`，确认因数据库不可用展示演示 fallback 书籍。
  - 浏览器打开 `/reader?bookId=sample-programming-fundamentals`，确认 reader 可访问并明确显示演示 fallback、只读、进度保存不可用。

## 9. 验证命令

```bash
git status --short
pnpm typecheck
pnpm lint
pnpm exec eslint apps/web/src/app/agent/page.tsx apps/web/src/lib/reader-progress.ts apps/web/src/app/reader/page.tsx packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts packages/ai-core/src/agent/runtime-policy-preview.ts packages/ai-core/src/llm-provider-config.ts packages/ai-core/src/spark-provider.ts
pnpm dev
```

还执行了：

```powershell
if ($env:DATABASE_URL) { 'DATABASE_URL=set' } else { 'DATABASE_URL=missing' }
git status --short package.json pnpm-lock.yaml packages/db/prisma apps/web/prisma prisma
```

## 10. 验证结果

- `pnpm lint`：通过。
- 关键修改文件 eslint：通过。
- `pnpm typecheck`：A136 允许范围内的 `/agent` 与 ai-core 错误已修复；全量仍失败于 books/learning 禁止修改范围。
- 本地 Web：`http://localhost:3000` 可启动。
- 浏览器替代验证：`/books` 与 `/reader?bookId=sample-programming-fundamentals` fallback 路径可访问；真实 DB 保存刷新恢复未完成。
- `package.json` / `pnpm-lock.yaml`：未修改。
- Prisma schema / migrations：未修改。
- 本轮删除文件：无。
- 未硬编码或输出 secret。

## 11. 未完成/风险

- reader progress 真实数据库端到端验收未完成，原因是当前环境缺少 `DATABASE_URL`。
- 全量 `pnpm typecheck` 仍被 books/learning 既有类型错误阻塞；这些文件不在 A136 允许修改范围，未读取或修复。
- 工作区开始前已有大量未提交改动，本轮未覆盖或回滚这些改动。

## 12. 下一轮建议

- A136+：单独处理 `apps/web/src/app/books/book-detail-loader.ts` 与 `/learning` attempt signal 类型错误，恢复全量 `pnpm typecheck`。
- 数据库验收轮：配置 `DATABASE_URL`、初始化 Prisma 表并确保 `demo@example.com` 与可读书籍章节存在，再执行 reader progress 保存后刷新恢复浏览器验收。

## 13. 项目总进度

项目总进度：22.40%
