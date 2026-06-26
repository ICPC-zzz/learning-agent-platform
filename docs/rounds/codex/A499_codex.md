# A499 Codex 恢复总结

## 1. 本轮性质

本轮按用户提供的旧 UI 截图与 A499 恢复说明，恢复此前已存在但入口缺失的 Codeforces 题库、个人 Codeforces 画像、学习分析入口与 AI 代码分析闭环。

本轮没有恢复书库、Reader、自建 OJ、Docker 判题或完整题面。

## 2. 证据盘点

已写入：

- `.codex_tmp/a499_feature_recovery_inventory.md`

盘点结论：

- `/problems` 当前页面被简化为 10 道内置示例题，但 Codeforces loader、metadata mapper、curated pool 与候选题查询代码仍在当前工作区。
- `/user` 页面没有挂载旧 Codeforces 仪表盘，但 `CodeforcesDashboardClient`、`CfLearningReport`、绑定/同步/action 均仍存在。
- `/ai` 已经挂载 `AiAssistantTabs`，其中包含代码分析面板、进度条、结构化报告和历史记录入口。

## 3. 修改文件

- `apps/web/src/app/problems/page.tsx`
- `apps/web/src/app/problems/problem-library-page-data.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/user/page.tsx`
- `.codex_tmp/a499_feature_recovery_inventory.md`
- `docs/rounds/codex/A499_codex.md`

## 4. 恢复内容

### `/problems`

- 从内置示例题页面改为 Codeforces 最小元数据题库页。
- 使用现有 `loadProblemLibraryPageData` 读取本地数据库 Codeforces 题目。
- 显示：
  - name/title
  - rating
  - tags
  - contestId + index
  - Codeforces 原题链接
- 支持 GET query 筛选：
  - `q`
  - `tags`
  - `minRating`
  - `maxRating`
  - `page`
  - `pageSize`
- 挂载 `ContestCountdown`，通过既有 server action 读取近期 Codeforces contest。
- 不进入旧本地题目详情页展示完整题面。
- 不提供本地提交、判题、Docker 或完整题面。

### `/user`

- 挂载 `CodeforcesDashboardClient`。
- 复用现有 `loadCodeforcesDashboard` 读取绑定账号、提交统计、题目统计和 rating history。
- 恢复绑定/解绑/同步入口。
- 已绑定账号时恢复截图对应的 Codeforces 画像区域：
  - 基础信息
  - 提交结果分布
  - 标签提交占比
  - Rating 变化
  - 标签能力详情
  - Rating 分布
- 学习分析与错题复习计划入口来自同一组件：
  - `generateCfLearningAnalysis`
  - `generateCfWrongBookReview`
- 当数据库快照不可用时，页面退化为未绑定状态，不让页面崩溃。

### `/ai`

- 本轮未改代码。
- 验证当前入口已存在：
  - 普通对话
  - 代码分析
  - 记忆管理
  - `CodeAnalysisPanel`
  - `AnalysisProgressBar`
  - `CodeAnalysisReport`
  - `A492PersonalizedReport`
  - `AnalysisHistoryPanel`

## 5. 题库数据

只读查询确认：

- 数据库 `Problem` 表中 `source = "codeforces"` 的记录数：`2005`
- `/problems` 页面经过现有 catalog policy 后显示可展示题池：`2000`

差异原因：页面展示继续使用既有 Codeforces catalog policy 过滤不适合展示/推荐的题目。

## 6. 比赛数据

比赛倒计时使用当前已有链路：

- `apps/web/src/app/problems/ContestCountdown.tsx`
- `apps/web/src/app/problems/cf-contest-server-action.ts`
- `apps/web/src/lib/cf-contest-service.ts`

数据来自 server-side Codeforces `contest.list` adapter。若 API guard 或网络失败，组件显示安全空态/错误态。

## 7. 验证结果

通过：

```powershell
pnpm -C apps/web typecheck
pnpm -C packages/db typecheck
pnpm -C packages/ai-core typecheck
pnpm -C packages/book-engine typecheck
pnpm -C packages/learning-engine typecheck
pnpm -C packages/shared typecheck
```

HTTP 验证：

- `/`：200
- `/articles`：200
- `/problems`：200
- `/user`：200
- `/ai`：200

浏览器验证：

- `/problems` 首屏渲染真实 Codeforces 题卡，首屏 50 个 Codeforces 原题链接。
- `/problems` 不再出现“内置示例题”旧文案。
- `/problems` 在 390px 移动宽度下无横向溢出；同时补齐全局 `lap-hide-mobile` / `lap-show-mobile` 响应式规则。
- `/user` 渲染 Codeforces 区域；未登录浏览器显示绑定入口。
- `/ai` 渲染 AI 助手、代码分析和记忆管理入口。

## 8. 相关测试

执行但未全部通过：

```powershell
pnpm -C apps/web exec node src/app/a479-codeforces-problems-metadata.test.mjs
pnpm -C apps/web exec node src/app/a484-curated-pool-and-agent-candidates.test.mjs
pnpm -C apps/web exec node src/app/a462-ai-assistant-page.test.mjs
pnpm -C apps/web exec node src/app/user/page-source.test.mjs
```

结果：

- `a479` 失败原因：测试仍期待旧源码字符串和旧组件分工。
- `a484` 失败原因：测试仍期待旧 targetSize 上下限，当前实现已有 `full-pool-v2`，允许更大题池。
- `a462` 失败原因：从 `apps/web` 目录运行时测试路径拼出双层 `apps/web/apps/web/...`。
- `user/page-source` 失败原因：测试仍期待未登录访问 `/user` 强制 redirect；当前 A498 后 `/user` 是可见个人中心预览。

本轮没有为通过过期断言去回滚当前产品行为。

## 9. 未完成项

- 未用真实已绑定 Codeforces 用户在浏览器中完整点击生成学习分析，因为当前浏览器会话没有 dev login / CF 绑定 cookie。
- 未验证真实 Codeforces API 返回比赛列表是否成功；组件已挂载并有 guard fallback。
- 未执行真实 LLM 调用。
- 未执行任何提交代码、判题、Docker 或危险工具。

## 10. 数据库与 Git 边界

- 未执行 Prisma migrate。
- 未执行 Prisma db push。
- 未执行数据库写入脚本。
- 本轮只做了数据库只读计数和页面只读渲染。
- 未执行 `git add`。
- 未执行 `git commit`。
- 未执行 `git push`。
- 未执行 `git reset` / `git restore` / `git stash` / `git clean`。

## 11. 运行方式

本轮启动的开发服务：

```powershell
pnpm -C apps/web exec next dev --hostname 127.0.0.1 --port 3102
```

访问：

- `http://127.0.0.1:3102/problems`
- `http://127.0.0.1:3102/user`
- `http://127.0.0.1:3102/ai`

## 12. 下一轮唯一建议

下一轮建议只处理一件事：更新/清理当前已过期的源检查测试，使测试断言对齐 A498 后的产品范围与 A499 恢复后的 Codeforces 页面结构。

项目总进度建议维持 `61.00%`，本轮是恢复入口和接线，不改变长期总进度口径。
