# A397 — 学习报告/复习推荐/今日计划客户端水合与学习中心入口 v1

**模型**: Claude Sonnet (Claude Code)
**模式**: 普通 Claude Code（Web 学习闭环，非 Desktop，非 Go）
**日期**: 2026-06-11

## 1. 修改文件清单

### 新增 — 基础数据模块
- `apps/web/src/lib/learning-insight-local-data.ts` — 统一 local learning insight 数据读取与格式化（纯函数，无浏览器 API）
- `apps/web/src/lib/learning-insight-local-data.test.mjs` — 20 tests

### 新增 — 客户端水合组件
- `apps/web/src/app/user/report/UserLearningReportClientHydration.tsx` — /user/report 客户端 localStorage 水合
- `apps/web/src/app/user/report/user-learning-report-client-hydration.test.mjs` — 7 tests
- `apps/web/src/app/user/review/UserReviewRecommendationsClientHydration.tsx` — /user/review 客户端 localStorage 水合
- `apps/web/src/app/user/review/user-review-recommendations-client-hydration.test.mjs` — 6 tests
- `apps/web/src/app/user/today/UserTodayPlanClientHydration.tsx` — /user/today 客户端 localStorage 水合
- `apps/web/src/app/user/today/user-today-plan-client-hydration.test.mjs` — 8 tests
- `apps/web/src/app/user/UserLearningInsightLocalStatsHydration.tsx` — /user dashboard 本地学习洞察统计补充
- `apps/web/src/app/user/user-learning-insight-local-stats-hydration.test.mjs` — 5 tests

### 新增 — 学习中心页
- `apps/web/src/app/learning/page.tsx` — 学习中心统一入口页

### 修改
- `apps/web/src/app/user/report/page.tsx` — 接入 UserLearningReportClientHydration（替换占位 div）
- `apps/web/src/app/user/review/page.tsx` — 接入 UserReviewRecommendationsClientHydration（替换占位 div）
- `apps/web/src/app/user/today/page.tsx` — 接入 UserTodayPlanClientHydration（替换占位 div）
- `apps/web/src/app/user/page.tsx` — 新增导入 UserLearningInsightLocalStatsHydration + A397 学习中心入口 section

## 2. `/user/report` 水合说明

- `UserLearningReportClientHydration` 作为 "use client" 组件，在浏览器端读取全部 8 个 localStorage store（learningActivities、readingSessions、wrongBook、aiHistory、recentReading、recentPractice、favoriteProblems、bookmarks、notes）
- 将原始数据映射为安全摘要格式后调用 A396 的 `buildLearningReportView`
- 渲染今日摘要、近 7 天、阅读统计、题目统计、错题统计、笔记/书签/AI 历史、学习状态标签
- 标注「客户端本地数据 · 规则型统计 · 未调用 LLM · 未接生产账号」
- 空数据时显示引导文案

## 3. `/user/review` 水合说明

- `UserReviewRecommendationsClientHydration` 从 7 个 localStorage store 读取数据
- 映射为安全摘要后调用 A396 的 `buildReviewRecommendationsView`
- 渲染 7 级优先级推荐列表，每条含 title、reason、priority badge、sourceType、targetLink
- 显示优先级色标（P1-2 红色、P3-4 橙色、P5-6 蓝色）
- 无数据时显示空态引导
- 标注「规则型推荐 · 未调用 LLM · 未接生产账号」

## 4. `/user/today` 水合说明

- `UserTodayPlanClientHydration` 从 6 个 localStorage store 读取数据
- 映射为安全摘要后调用 A396 的 `buildTodayPlanView`
- 渲染 3–5 个任务（todo/suggested 区分）
- 每个任务显示 estimatedMinutes、reason、targetLink、devOnlyLabel
- 无数据时提供基础建议
- 标注「今日计划为规则型预览 · 未调用 LLM · 不会写入数据库」

## 5. `/user` dashboard 动态统计说明

- `UserLearningInsightLocalStatsHydration` 添加到 A396 学习反馈中心 section 底部
- 显示：今日学习活动数、待复习推荐数、本地活动总数、本地阅读时长、错题待复习数
- 分区显示「本地 fallback 补充（localStorage）」—— 黄色虚线边框
- 不覆盖服务端 DB 数字
- 使用 `mounted` state 避免 hydration mismatch
- 空数据时显示空态

## 6. `/learning` 学习中心说明

- 新建页面 `/learning`，作为学习功能统一入口
- 8 张入口卡片：学习报告、复习推荐、今日计划、学习活动、错题本、最近阅读、最近刷题、AI 问答历史
- 响应式网格布局（minmax(240px, 1fr)）
- 每张卡片含：label、title、description、accent 色按钮 "进入 →"
- 页面标注「规则型学习反馈 · 开发预览 · localStorage fallback · 未调用 LLM · 未接生产账号」
- Footer 列出数据来源说明

## 7. 是否调用 LLM

**否**。所有水合组件仅从 localStorage 读取数据，调用 A396 确定性规则函数生成报告/推荐/计划。未调用任何 LLM provider。

## 8. 是否写 DB

**否**。未执行任何 Prisma 操作（migrate/generate/db push）。所有数据来自浏览器 localStorage，不持久化到数据库。

## 9. lint/typecheck 结果

- **Lint**: PASS（VM lint complete, 0 errors）
- **Typecheck**: PASS（typecheck 0 errors）

## 10. 测试结果

| 测试文件 | pass | fail | 备注 |
|----------|------|------|------|
| learning-insight-rules.test.mjs | 21 | 0 | A396 已有 |
| user-learning-report-view-model.test.mjs | 17 | 0 | A396 已有 |
| user-review-recommendations-view-model.test.mjs | 16 | 0 | A396 已有 |
| user-today-plan-view-model.test.mjs | 14 | 0 | A396 已有 |
| user-dashboard-stats-view-model.test.mjs | 15 | 0 | 已有 |
| **learning-insight-local-data.test.mjs** | **20** | **0** | **A397 新增** |
| **user-learning-report-client-hydration.test.mjs** | **7** | **0** | **A397 新增** |
| **user-review-recommendations-client-hydration.test.mjs** | **6** | **0** | **A397 新增** |
| **user-today-plan-client-hydration.test.mjs** | **8** | **0** | **A397 新增** |
| **user-learning-insight-local-stats-hydration.test.mjs** | **5** | **0** | **A397 新增** |
| **A397 新增总计** | **46** | **0** | |
| **累计总计** | **129** | **0** | |

## 11. Skip 原因

- 不做浏览器手动验收（等 Codex 额度恢复）
- 不启动 dev server
- 不执行 Prisma migration / generate / db push
- 不调用 LLM
- 不写 DB
- 不修改 Desktop
- `/learning` 页面不涉及 learning-center-view-model.test.mjs（页面为纯展示组件，卡片配置为常量，无需独立 view model 测试）

## 12. 安全边界确认

- 未硬编码 API key / token / secret / DATABASE_URL
- 所有水合组件从 localStorage safe 函数读取，通过现有 store 验证过滤
- 所有推荐/计划标注 safetyLabel 和 devOnlyLabel
- UI 文案标注「客户端本地数据」「规则型统计」「未调用 LLM」「未接生产账号」
- 未出现「AI 已自动规划」「生产学习报告」「真实云端同步」「Agent 已运行」等误导文案
- 不读取 raw prompt/response、fullChapterContent、submittedCode
- 不保存数据到 DB
- 未新增公开无保护 API route
- 未修改 Desktop
- 未执行 Prisma migration

## 13. 未完成事项

- 浏览器手动验收所有 4 个子页面 + 学习中心（等 Codex 额度恢复后）
- `/user` dashboard 学习洞察统计（客户端）与服务端统计完全联动（当前为独立分区）
- 历史复习推荐持久化（当前仅预览）
- `/learning` 页面接入客户端动态统计（当前为纯导航）

## 14. 下一轮建议

- A398: 浏览器手动验收 A395 错题本 + A396 学习报告/复习推荐/今日计划 + A397 客户端水合 + 学习中心页面
- 或 A398: 继续下一个学习业务闭环（如学习目标设定、学习周报、学习 streak）
- 或 A398: 将 Dashboard 学习洞察统计的客户端/服务端联动完善为统一展示

## 15. 项目进度

**约 85.60%**（上一轮 A396: 85.00%，本轮新增客户端水合 4 组件 + 学习中心页 + 统一数据模块 + 46 测试 pass）
