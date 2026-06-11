# A396 — Web 学习报告、复习推荐与今日计划 v1

**模型**: Claude Sonnet (Claude Code)
**模式**: 普通 Claude Code（Web 学习闭环，非 Desktop，非 Go）
**日期**: 2026-06-11

## 1. 修改文件清单

### 新增 — 基础类型与规则
- `apps/web/src/lib/learning-insight-types.ts` — 安全摘要类型、推荐/计划/报告类型定义
- `apps/web/src/lib/learning-insight-rules.ts` — 确定性推荐规则、今日计划规则、状态标签计算

### 新增 — 学习报告
- `apps/web/src/app/user/report/page.tsx` — `/user/report` SSR 页面骨架 + 客户端水合占位
- `apps/web/src/app/user/report/user-learning-report-view-model.ts` — 学习报告视图模型（自包含，无跨目录导入）
- `apps/web/src/app/user/report/user-learning-report-view-model.test.mjs` — 17 tests

### 新增 — 复习推荐
- `apps/web/src/app/user/review/page.tsx` — `/user/review` SSR 页面骨架 + 客户端水合占位
- `apps/web/src/app/user/review/user-review-recommendations-view-model.ts` — 复习推荐视图模型
- `apps/web/src/app/user/review/user-review-recommendations-view-model.test.mjs` — 16 tests

### 新增 — 今日计划
- `apps/web/src/app/user/today/page.tsx` — `/user/today` SSR 页面骨架 + 客户端水合占位
- `apps/web/src/app/user/today/user-today-plan-view-model.ts` — 今日计划视图模型（自包含）
- `apps/web/src/app/user/today/user-today-plan-view-model.test.mjs` — 14 tests

### 新增 — 通用测试
- `apps/web/src/lib/learning-insight-rules.test.mjs` — 21 tests

### 修改
- `apps/web/src/app/user/page.tsx` — 新增 nav 链接（Learning Report / Review Recs / Today Plan）+ A396 学习反馈中心区域

## 2. 学习报告 `/user/report` 说明

- 聚合阅读、题目、错题、笔记/书签、AI 问答历史数据
- 展示今日摘要、近 7 天摘要、阅读统计、题目统计、注释统计
- 学习状态标签：阅读活跃 / 刷题待加强 / 错题待复习 / 暂无数据
- 所有统计为规则型计算，不调用 LLM
- 页面标注「规则型统计 · 未调用 LLM · local fallback · 未接生产账号」
- 当前为 SSR 骨架 + 客户端水合占位，实际渲染在浏览器 localStorage 数据聚合后

## 3. 复习推荐 `/user/review` 说明

7 级优先级规则：

1. needs-review 错题（up to 3）
2. wrongCount ≥ 2 的高频错题（up to 2）
3. 最近练习状态为 needs-review 的题（up to 2）
4. 最近阅读但未完成的章节（up to 2）
5. 有笔记/书签但近期未阅读的章节（up to 2）
6. AI 问答历史中出现过的章节（up to 1）
7. 收藏但未练习的题目（up to 2）

- 每条推荐包含 recommendationId, title, reason, targetType, targetLink, priority, sourceType, safetyLabel
- 去重：同一 targetType+targetId 只保留一条
- 上限 10 条
- safetyLabel: "规则型推荐 · 未调用 LLM · 开发预览 · local fallback · 未接生产账号"

## 4. 今日计划 `/user/today` 说明

- 生成 3–5 个任务：
  1. 复习错题（todo，如有 needs-review）
  2. 继续阅读（suggested，15 分钟）
  3. 回看笔记（suggested，5 分钟）
  4. 做收藏题（suggested，8 分钟）
  5. 查看 AI 问答历史（suggested，5 分钟）
- 每个任务含 taskId, title, description, estimatedMinutes, targetLink, status, reason, devOnlyLabel
- 不保存任务到 DB，仅当日预览
- devOnlyLabel: "开发预览 · 规则型 · 未调用 LLM"

## 5. `/user` dashboard 联动

- 新增 nav 链接：Learning Report / Review Recs / Today Plan
- 新增 A396 学习反馈中心 section，包含三个页面入口 + 数据来源说明

## 6. `/learning` 页面接入

**未接入**。项目中没有 `/learning` 页面（glob 无匹配文件），按 spec 跳过。

## 7. 是否调用 LLM

**否**。所有推荐、计划、报告均为确定性规则计算，不调用任何 LLM provider。

## 8. 是否写 DB

**否**。未执行 Prisma migration / generate / db push。所有数据来自 localStorage fallback。今日计划不保存到 DB。

## 9. lint/typecheck 结果

- **Lint**: PASS（VM lint complete, 0 errors）
- **Typecheck**: PASS（typecheck 0 errors）

## 10. 测试结果

| 测试 | pass | fail | 备注 |
|------|------|------|------|
| learning-insight-rules.test.mjs | 21 | 0 | 新增：状态标签/推荐/计划/安全 |
| user-learning-report-view-model.test.mjs | 17 | 0 | 新增：空数据/聚合/安全/状态 |
| user-review-recommendations-view-model.test.mjs | 16 | 0 | 新增：优先级/去重/安全/链接 |
| user-today-plan-view-model.test.mjs | 14 | 0 | 新增：3-5 任务/估计/安全/标签 |
| user-dashboard-stats-view-model.test.mjs | 15 | 0 | 已有 |
| local-learning-activity-store.test.mjs | pass | 0 | 已有 |
| local-problem-wrong-book-store.test.mjs | pass | 0 | 已有 |
| local-reader-ai-history-store.test.mjs | 33 | 0 | 已有 |
| **A396 新增** | **68** | **0** | |

## 11. Skip 原因

- `/learning` 页面不存在，未接入（按 spec 跳过）
- 未执行 Prisma migrate / generate / db push
- 未启动 dev server
- 未做浏览器手动验收
- 未执行 real DB 写操作
- 未调用 LLM

## 12. 安全边界确认

- 未硬编码 API key / token / secret / DATABASE_URL
- 所有推荐/计划标注 safetyLabel 和 devOnlyLabel
- UI 文案标注「规则型推荐」「未调用 LLM」「开发预览」「local fallback」「未接生产账号」
- 未出现「AI 已自动规划」「生产学习报告」「真实云端同步」「Agent 已运行」等误导文案
- 不读取 raw prompt/response、fullChapterContent、submittedCode
- 不保存任务到 DB
- 未新增公开无保护 API route
- 未修改 Desktop
- 未执行 Prisma migration

## 13. 未完成事项

- 浏览器手动验收（等 Codex 额度恢复后）
- 客户端水合组件（`/user/report`、`/user/review`、`/user/today` 当前为 SSR 骨架 + 占位，实际聚合数据需客户端 JS 渲染）
- `/user` dashboard 统计数字联动（今日任务数、待复习项数量需客户端水合）
- 历史复习推荐持久化（当前仅预览）

## 14. 下一轮建议

- A397: 浏览器手动验收 A396 学习报告/复习推荐/今日计划页面 + A395 错题本页面
- 或 A397: 继续下一个学习业务闭环（如阅读挑战、学习目标设定、学习周报等）
- 或 A397: 客户端水合组件实现（将 report/review/today 页面从骨架升级为完整客户端渲染）

## 15. 项目进度

**约 85.00%**（上一轮 84.30%，本轮新增学习报告 + 复习推荐 + 今日计划 v1 完整规则体系 + 68 测试 pass）
