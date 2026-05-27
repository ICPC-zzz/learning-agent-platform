# A249 Codex 记录

## 1) 本轮目标
- 在 Web `/learning` 页面新增“继续阅读 / 前往 Reader”开发预览入口。
- 让用户可从最近阅读进度、下一步学习建议、今日学习任务卡片跳转到对应 `/reader?bookId=...&chapterId=...`。
- 保持现有 Learning 本地闭环能力不回退，不扩大到 schema/API/Reader 逻辑改造。

## 2) A248 后状态
- A248 已完成 Desktop 系统诊断中心 GUI 验证闭环。
- A222-A248 改动仍未提交，本轮按要求不执行 `git add / git commit / git push`。
- 项目进度基线按提示为约 50.00%。

## 3) 实际阅读文件
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- `apps/web/src/app/learning/page.tsx`
- `apps/web/src/app/learning/recent-reading-progress-types.ts`
- `apps/web/src/app/learning/components/LearningRecentReadingProgressPanel.tsx`
- `apps/web/src/app/learning/components/LearningNextStepSuggestionPanel.tsx`
- `apps/web/src/app/reader/page.tsx`
- 额外最小读取（参数/类型确认）：
  - `apps/web/src/app/reader/reader-query.ts`
  - `apps/web/src/app/learning/learning-next-step-suggestion-types.ts`
  - `apps/web/src/app/learning/learning-daily-task-types.ts`
  - `apps/web/src/app/learning/components/LearningDailyTaskPanel.tsx`
  - `apps/web/src/app/learning/components/LearningDailyTaskPanelClient.tsx`
  - `apps/web/src/app/learning/learning-next-step-suggestion-mapper.ts`
  - `apps/web/src/app/learning/learning-daily-task-mapper.ts`
- 额外一次实现参考读取（最小片段）：
  - `apps/web/src/app/books/book-detail-loader.ts`（仅用于对齐现有 Reader href 拼接风格）

## 4) 修改文件
- `apps/web/src/app/learning/learning-reader-link.ts`（新增）
- `apps/web/src/app/learning/components/LearningRecentReadingProgressPanel.tsx`
- `apps/web/src/app/learning/components/LearningNextStepSuggestionPanel.tsx`
- `apps/web/src/app/learning/components/LearningDailyTaskPanelClient.tsx`
- `docs/rounds/codex/A249_codex.md`（新增）

## 5) Reader href 构造方式
- 新增 `buildReaderHref(bookId?: string | null, chapterId?: string | null): string | null`。
- 先做字符串规范化（trim + 空值判断），任一缺失则返回 `null`。
- 有效时使用 `URLSearchParams` 生成查询串：
  - `/reader?bookId=<encoded>&chapterId=<encoded>`
- helper 仅做字符串构造，不访问 `window`、不查 DB、不写 localStorage。

## 6) 新增 Reader 入口的 Learning 卡片
- 最近阅读进度卡片：
  - `source=database` 且可构造 href 时显示“继续阅读”链接。
  - 缺少参数时显示不可跳转提示。
- 下一步学习建议卡片：
  - 有关联章节时显示“按建议继续阅读”链接。
  - 无关联章节时显示不可跳转说明。
- 今日学习任务卡片（可选增强已实现）：
  - 若 `relatedBookId/relatedChapterId` 可构造 href，则显示单一“打开关联 Reader 章节”链接。
  - 未为每条任务单独加链接，避免 UI 过密。

## 7) database / empty / fallback 场景处理
- `database`：
  - 允许展示可跳转 Reader 链接（前提是 bookId/chapterId 可用）。
- `empty`：
  - 显示“暂无同步记录，先从 Reader 保存/同步一次进度。（开发预览）”。
- `fallback`：
  - 显示“数据库不可用时无法生成 Reader 跳转建议，可直接从 Reader 入口进入。（开发预览）”。
- 通用补充文案：
  - “该跳转仅根据开发预览同步记录生成，不代表生产级学习路径推荐。”
  - “若链接不可用，请先在 Reader 中产生本地记录并手动同步。”

## 8) Web 跳转验证结果
- 已启动 Web 开发服务器并请求：
  - `http://localhost:3000/learning`
  - `http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
- 在 `/learning` 返回 HTML 中确认：
  - 最近阅读进度卡片渲染“继续阅读”并带 `bookId/chapterId` 查询参数。
  - 下一步学习建议卡片渲染“按建议继续阅读”并带 `bookId/chapterId` 查询参数。
  - 今日学习任务卡片渲染“打开关联 Reader 章节”并带 `bookId/chapterId` 查询参数。
- 访问对应 `/reader?...` 返回 Reader 页面内容，说明跳转目标路由可达。
- 说明：
  - 本轮采用本地 HTTP 请求验证路由可达与服务端渲染结果；未执行真实浏览器点击录制。
  - `empty/fallback` 的 UI 分支做了源码分支核查，未在运行时强制切换场景复测。

## 9) typecheck/lint 结果
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过

## 10) 安全边界确认
- 未新增 DB 查询/写入逻辑。
- 未新增 API、server action、route handler、后台任务。
- 未修改 Reader 手动同步逻辑与自动同步开关策略。
- 未接入真实 LLM provider、未调用真实 LLM API、未执行工具链路。
- 未修改 Desktop、Agent、安全策略相关文件。
- 未泄露 secrets / DATABASE_URL / token。

## 11) 未完成问题
- 未在同一轮中构造并实测 `source=empty`、`source=fallback` 的真实运行时页面快照，仅完成代码分支核查。
- 未做浏览器自动化点击回放（仅 HTTP 请求级验证）。

## 12) 下一轮建议
- 若本轮通过，优先推进 Reader DB 同步字段 schema 设计评审（仅设计，不落 schema/migration）。
- 或推进 Desktop 系统诊断中心可复用 e2e 测试资产固化。
- 或推进 Learning → Reader 跳转的 Desktop 内联验证。
- 本轮不生成提交提示词。
