# A242 Codex 记录

## 1. 本轮目标
完成 A241「本地任务周报预览（开发预览）」的 GUI 自动化验证闭环；仅在发现明确 bug 时做最小修复；不做新功能开发，不做 Git 提交。

## 2. 实际读取范围
- `AGENTS.md`
- `docs/product/PRODUCT_SPEC.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
- `apps/web/src/app/learning/**`（与周报卡片相关文件）

说明：仓库中未找到 `docs/codex-tasks/CODEX_RULES.md`（路径不存在）。

## 3. GUI 自动化验证（Playwright）
说明：仓库未内置 Playwright CLI，本轮在临时目录 `E:\code\_tmp\a242-playwright` 安装 Playwright，仅用于本轮验证，不改仓库依赖。

### 3.1 页面渲染验证
验证 URL：`http://localhost:3001/learning`（3000 端口被占用，Next 自动切换到 3001）

验证结果（通过）：
- `今日学习任务（开发预览）`
- `今日任务完成统计（开发预览）`
- `本地任务历史趋势（开发预览）`
- `本地任务周报预览（开发预览）`

### 3.2 勾选/重置联动验证
操作：
1. 清理 `lap.learning.dailyTasks.*` key。
2. 勾选今日任务第一个 checkbox。
3. 查看周报卡片。
4. 点击“重置今日任务状态（本地）”。
5. 再次查看周报卡片。
6. 刷新页面验证勾选后状态可恢复。

结果（通过）：
- 勾选后周报变为 `活跃记录天数 1 天`，`完成任务数 1/3 项`，`整体完成率 33%`。
- 重置后周报变为 `完成任务数 0/3 项`，`整体完成率 0%`（合理归零状态）。
- 刷新后，勾选状态可在周报恢复（`1/3 项`）。

### 3.3 最近 7 天 localStorage 聚合验证
手工写入最近 7 天不同 `dateKey` 的 `lap.learning.dailyTasks.*` 记录（6 天有记录，1 天无记录），期望：
- 活跃天数：6
- 总完成数：9
- 总任务数：17
- 完成率：53%
- 最佳完成日：`2026-05-25`（3/3，100%）
- 最近记录日：`2026-05-27`
- 规则建议：`本周学习节奏稳定`

结果（通过）：上述字段全部匹配。

### 3.4 清理 key 后空状态验证
操作：清理全部 `lap.learning.dailyTasks.*` key。

结果（通过）：
- 周报显示 `0 天`、`0/0 项`、`0%`、`暂无`。
- 显示空状态文案（`暂无本地周报` / `当前浏览器暂无可生成周报的本地任务记录`）。
- 页面不崩溃。

### 3.5 Console / Network 验证
结果（通过）：
- Console 无 error。
- 无 pageerror。
- 未发现周报卡片触发业务 API / server action / DB 写入请求（仅本地 localStorage 读写）。

## 4. 发现并修复的明确 bug（最小修复）

### 4.1 bug 描述
`/learning` 在开发模式存在 hydration mismatch：SSR 初始渲染与客户端首帧不一致（localStorage 在初始 state 计算阶段参与渲染），会触发 React hydration 报错与 Next 调试端点请求。

### 4.2 修复策略
仅在 `apps/web/src/app/learning` 范围最小修复：
- 把依赖 localStorage 的初始 state 改为稳定默认值（SSR/CSR 一致）。
- 首次真实 localStorage 读取放到 `useEffect` 刷新流程中。

### 4.3 修改文件
1. `apps/web/src/app/learning/components/LearningDailyTaskHistoryPanelClient.tsx`
   - `useState` 初始化改为 `createDefaultHistoryViewModel()`。
   - 新增 `createDefaultHistoryViewModel()`。
   - `createHistoryViewModel()` 基于 default model 再读取 localStorage。
2. `apps/web/src/app/learning/components/LearningDailyTaskWeeklyReportPanelClient.tsx`
   - `useState` 初始化改为 `createDefaultWeeklyReportViewModel()`。
   - 新增 `createDefaultWeeklyReportViewModel()`。
   - `createWeeklyReportViewModel()` 先构建稳定 default model，再执行 localStorage 聚合。

## 5. 命令验证
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过
- `node --test apps/desktop/route-policy.test.mjs`：通过（26/26）

## 6. 安全边界核对
本轮保持以下边界：
- 数据仅来自浏览器 localStorage。
- 未新增 API / server action。
- 未读写 DB，未改 Prisma schema。
- 未调用真实 LLM。
- 未执行 Agent loop。
- 未改 Reader/Agent/Desktop 业务逻辑。
- 未读取 `E:\code\harness-main`、`E:\code\ccx`、`E:\code\claude-desktop-app-main`。
- 未执行 `git add / commit / push`。

## 7. 产物
- 自动化验证截图：`docs/rounds/codex/A242_learning_weekly_report.png`
- 本文档：`docs/rounds/codex/A242_codex.md`

## 8. 未完成问题
- 无阻塞性未完成项。
- 说明：仓库当前存在大量与本轮无关的既有未提交变更，本轮未处理。

## 9. 下一轮建议
1. 在保留 localStorage 预览模式的前提下，为周报卡片补一个小型回归测试（可在可用浏览器环境下复用本轮脚本逻辑）。
2. 继续推进 Learning 端与 Reader 的“仅本地预览”联动验证用例，避免引入非预期后端依赖。
