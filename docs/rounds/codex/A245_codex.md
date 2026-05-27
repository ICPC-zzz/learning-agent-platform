# A245 Codex 记录

## 1. 本轮目标
在 `/learning` 页面新增“本地周报导出预览（开发预览）”能力：
- 复用 A241-A242 的本地任务周报聚合逻辑。
- 仅基于 `lap.learning.dailyTasks.*` localStorage 记录生成 Markdown 草稿。
- 支持本地复制到剪贴板。
- 支持浏览器端下载 `.md`（Blob + `URL.createObjectURL`）。
- 不新增 API、不查/写 DB、不调用真实 LLM、不执行工具。

## 2. A244 后状态
- A244 已完成 Desktop 三入口 GUI 验证与文案微修复。
- Learning 页已具备：今日任务、本地统计、本地历史趋势、本地周报预览（A241-A242）。
- A222-A244 仍为未提交本地改动状态；本轮按要求不做提交操作。

## 3. 实际阅读文件
必读：
1. `docs/codex-context/CURRENT_HANDOFF.md`
2. `docs/codex-context/CODEX_RULES.md`
3. `docs/codex-context/SAFETY_BOUNDARIES.md`
4. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
5. `docs/codex-context/DOC_WORKFLOW.md`
6. `apps/web/src/app/learning/page.tsx`
7. `apps/web/src/app/learning/learning-daily-task-local-storage.ts`
8. `apps/web/src/app/learning/learning-daily-task-weekly-report-types.ts`
9. `apps/web/src/app/learning/components/LearningDailyTaskWeeklyReportPanelClient.tsx`
10. `docs/rounds/codex/A244_codex.md`

可选参考：
1. `apps/web/src/app/learning/components/LearningDailyTaskWeeklyReportPanel.tsx`
2. `apps/web/src/app/learning/components/LearningDailyTaskHistoryPanelClient.tsx`
3. `apps/web/src/app/learning/components/LearningDailyTaskStatsPanelClient.tsx`
4. `apps/web/src/app/learning/components/LearningDailyTaskPanelClient.tsx`
5. `apps/web/src/app/learning/components/LearningAbilityProfileSaveControls.tsx`

## 4. 修改文件
1. `apps/web/src/app/learning/page.tsx`
2. `apps/web/src/app/learning/learning-daily-task-weekly-report-types.ts`
3. `apps/web/src/app/learning/components/LearningDailyTaskWeeklyReportPanelClient.tsx`
4. `apps/web/src/app/learning/learning-daily-task-weekly-report.ts`（新增）
5. `apps/web/src/app/learning/learning-daily-task-weekly-report-export-types.ts`（新增）
6. `apps/web/src/app/learning/learning-daily-task-weekly-report-export.ts`（新增）
7. `apps/web/src/app/learning/components/LearningDailyTaskWeeklyReportExportPanel.tsx`（新增）
8. `apps/web/src/app/learning/components/LearningDailyTaskWeeklyReportExportPanelClient.tsx`（新增）
9. `docs/rounds/codex/A245_codex.md`（新增）

## 5. 周报导出数据来源
- 仅使用浏览器 localStorage 中前缀为 `lap.learning.dailyTasks.` 的记录。
- 读取入口：`listLearningDailyTaskLocalStateRecords()`。
- 周报聚合逻辑来自 `learning-daily-task-weekly-report.ts`（从原周报预览 client 抽出并复用）。
- 不读取 DB、不写 DB、不读 cookies、不写 sessionStorage。

## 6. Markdown 草稿生成规则
实现文件：`learning-daily-task-weekly-report-export.ts`
- 固定标题：`# 本地学习周报（开发预览）`
- 固定元信息：周期、数据来源、生成方式、活跃天数、总完成、完成率、最佳完成日、最近记录日、生成时间。
- 本周摘要：规则拼接（按完成率区间 + A241 周报 summary 描述拼接）。
- 每日概览：按最近 7 天聚合结果输出 `- yyyy-mm-dd：完成 x / y，完成率 x%`。
- 规则建议：固定规则模板（3 条），按完成率分段。
- 安全说明：固定声明“仅 localStorage、不写 DB、不调模型、不执行工具、非真实 AI 周报”。
- 无记录时不生成正文（`markdownText` 为空，`canCopy/canDownload=false`）。

## 7. copy / download 实现方式
实现文件：`LearningDailyTaskWeeklyReportExportPanelClient.tsx`
- 复制：
  - 优先 `navigator.clipboard.writeText(markdownText)`。
  - 非安全上下文回退 `textarea + document.execCommand("copy")`。
  - 成功提示：`已复制到剪贴板（本地操作）`。
  - 失败提示：`复制失败，可手动选择文本复制。`
- 下载：
  - `new Blob([markdownText], { type: "text/markdown;charset=utf-8" })`
  - `URL.createObjectURL(blob)` + 动态 `<a download="learning-weekly-report-*.md">`
  - 完成后 `URL.revokeObjectURL(...)`
  - 全程前端本地操作，不访问后端。

## 8. 与周报卡片和 localStorage 事件联动方式
- 周报预览卡片与导出卡片都监听：
  - `window.storage`
  - `lap.learning.dailyTasks.changed`
- 今日任务勾选/重置触发 `saveLearningDailyTaskLocalState()` 后会 dispatch changed 事件。
- 导出卡片在事件触发后自动重新计算导出 view model 与 Markdown 草稿。
- 未引入全局状态管理库。

## 9. 空状态与 localStorage 不可用处理
- localStorage 不可用：
  - `available=false`
  - 显示不可用原因（`localStorage 不可访问`）
  - 禁用复制/下载。
- localStorage 可用但无周记录：
  - 显示空状态提示“当前浏览器暂无可导出的本地周报记录，请先勾选今日学习任务。”
  - `markdownText` 为空，`canCopy/canDownload=false`。

## 10. Web / localStorage / clipboard 验证结果
已完成：
1. 启动 Web：`pnpm --filter @learning-agent-platform/web run dev`（端口 3000 占用，Next 自动切到 `http://localhost:3001`）。
2. 页面可达：`GET /learning` 返回 200。
3. 页面文本命中：新增“本地周报导出预览（开发预览）”“复制周报草稿”“下载 Markdown”在 HTML 响应中可检索。

未自动完成（如实说明）：
1. 本轮在 CLI 环境无法做真实浏览器点击交互，因此未直接完成 clipboard 成功/失败分支的 GUI 实操验证。
2. 未在浏览器 DevTools 内直接截图 Network 面板；基于源码确认未新增 API/server action/DB 请求路径。
3. localStorage 多日模拟写入与按钮点击联动建议在下一轮 GUI 验收中手动执行。

## 11. typecheck / lint 结果
1. `pnpm typecheck`：通过（0 errors）
2. `pnpm lint`：通过

## 12. 安全边界确认
- 未新增后端 API / route handler / server action。
- 未新增 DB 查询与写入。
- 未调用真实 LLM provider。
- 未执行真实工具。
- 未启动 Agent loop。
- 未保存 raw prompt / raw response。
- 导出内容仅本地生成，复制/下载均需用户点击触发。

## 13. 未完成问题
1. 真实 clipboard 交互与下载行为的 GUI 逐步验收尚未在本轮 CLI 中完成。
2. localStorage 多日期模拟（7 天聚合细节）需在浏览器中按步骤手动验证。

## 14. 下一轮建议
- 若本轮通过：优先推进 Learning 本地周报导出 GUI 验证修复（重点验证 clipboard 权限分支、下载文件名、空状态与重置联动）。
- 或推进 Reader DB 同步字段 schema 设计评审（仅文档评审，不改 schema）。
- 或推进 Desktop 系统诊断页扩展。
- 本轮不生成提交提示词（按要求）。
