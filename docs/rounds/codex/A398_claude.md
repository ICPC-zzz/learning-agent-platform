# A398 — Dashboard 学习洞察统计统一展示面板 v1

**模型**: Claude Sonnet (Claude Code)
**模式**: 普通 Claude Code（Web 学习闭环收口，非 Desktop，非 Go）
**日期**: 2026-06-11

## 1. 修改文件清单

### 新增

- `apps/web/src/app/user/user-dashboard-unified-stats-view-model.ts` — 统一 dashboard stats view model（类型、builder、safety check）
- `apps/web/src/app/user/UserDashboardUnifiedStatsPanel.tsx` — 统一统计面板组件（分组展示、source badge、目标链接、图例）
- `apps/web/src/app/user/UserDashboardUnifiedStatsHydration.tsx` — 客户端水合组件（读取 localStorage 全部 store，合并 server + local stats）
- `apps/web/src/app/user/user-dashboard-unified-stats-view-model.test.mjs` — 26 tests pass
- `apps/web/src/app/user/user-dashboard-unified-stats-hydration.test.mjs` — 11 tests pass

### 修改

- `apps/web/src/app/user/page.tsx` — 替换 A386 Dashboard Stats + A392 Learning Stats 为 A398 统一面板；移除 A391 local stats hydration + A397 local insight stats hydration（已整合到统一 panel）；所有入口保留

## 2. 统一统计面板说明

### 数据结构 (`UnifiedStatItem`)

每条统计拥有：
- `statId` — 唯一标识
- `label` — 中文标签
- `value` — 数字/字符串值
- `description` — 可读描述
- `source` — 数据来源：`server-dev-db` | `local-storage-fallback` | `placeholder-not-connected` | `mixed`
- `status` — 可用性：`available` | `empty` | `not-connected` | `preview`
- `href` — 目标链接（null 表示无链接）
- `safetyLabel` — 每条统计包含 "规则型统计 · [source badge] · 开发预览 · 未调用 LLM"
- `sortOrder` — 排序序号
- `group` — 分组：`reading` | `problems` | `review` | `ai-assist` | `activity-plan`

### 分组展示

| 分组 | 统计项 | |
|------|--------|-|
| 阅读 | 收藏书籍、最近阅读、阅读书签、阅读笔记 | 4 项 |
| 题目 | 收藏题目、最近刷题、错题本 | 3 项 |
| 复习 | 待复习推荐 | 1 项 |
| AI 辅助 | AI 问答历史 | 1 项 |
| 活动与计划 | 学习活动、阅读时长、今日计划任务 | 3 项 |

共 12 条统计。

### Source badge 颜色标记

- `DB`（蓝色）— 开发 DB 数据
- `localStorage`（黄色）— localStorage fallback，卡片左侧黄色边框
- `DB+local`（紫色）— 混合数据
- `—`（灰色）— not connected / placeholder

### 数据来源优先规则

- server source = "db" → 显示 server value
- server source = "db" + local 有数据 → source = "mixed"，value 用 server
- server source = "none" → fallback 到 local value，source = "local-storage-fallback"
- 都无数据 → source = "placeholder-not-connected"
- 每个统计的 safetyLabel 包含 "未调用 LLM"

## 3. server/local 数据来源说明

### server 数据（服务端 SSR 传入）

- `DashboardStatsView`（A386）：favoriteBooks、recentReading、bookmarks、notes、wrongBook、problem 数据
- `DashboardLearningStatsView`（A392）：learning activities、reading sessions 统计

### local 数据（客户端水合组件读取）

- 所有 9 个 localStorage store：favoriteBooks、recentReadings、favoriteProblems、recentPractice、wrongBook、bookmarks、notes、aiHistory、activities、readingSessions
- 每个 store 独立 try/catch，单个失败不影响其他
- 阅读时长和今日任务数由 `learning-insight-local-data.ts` 纯函数计算

### merge 策略

1. Server SSR 渲染时传入 server stats（可能为 null 或全空）
2. 客户端 mount 后读取 localStorage，构建 `DashboardLocalStatsInput`
3. `buildUnifiedStatsView` 合并 server + local，按 source 规则生成 12 条统计
4. 水合组件在 mount 前显示 server-only view，mount 后切换到 merged view

## 4. `/user` dashboard 变化说明

### 移除

- A386 "Learning Data Summary" 区域（分散的 dl/dt/dd 统计列表）
- A391 `UserDashboardLocalStatsHydration`（书签/笔记 local fallback 补充）
- A392 "Learning Stats" 区域（学习活动/阅读时长统计）
- A397 `UserLearningInsightLocalStatsHydration`（本地学习洞察统计补充）

### 新增

- A398 `UserDashboardUnifiedStatsHydration` — 取代上述 4 个组件为单一统一面板
- 统一面板包含：5 个分组、12 条统计、source badge、图例、数据来源说明

### 保留入口

- `/user/report`、`/user/review`、`/user/today`、`/learning`
- `/user/activity`、`/user/wrong-book`
- `/user/recent-reading`、`/user/recent-practice`
- `/user/favorites/books`、`/user/favorites/problems`
- `/user/bookmarks`、`/user/notes`、`/user/ai-history`

## 5. 是否调用 LLM

**否**。所有统计为确定性规则计算，不调用任何 LLM provider。

## 6. 是否写 DB

**否**。未执行任何 Prisma 操作（migrate/generate/db push）。所有数据来自服务端 DB loader（已有）和浏览器 localStorage。

## 7. lint/typecheck 结果

- **Lint**: PASS（VM lint complete, 0 errors）
- **Typecheck**: PASS（typecheck 0 errors）

## 8. 测试结果

| 测试文件 | pass | fail | 备注 |
|----------|------|------|------|
| user-dashboard-stats-view-model.test.mjs | 15 | 0 | A386 已有 |
| learning-insight-local-data.test.mjs | 20 | 0 | A397 已有 |
| learning-insight-rules.test.mjs | 21 | 0 | A396 已有 |
| user-learning-report-view-model.test.mjs | 17 | 0 | A396 已有 |
| user-review-recommendations-view-model.test.mjs | 16 | 0 | A396 已有 |
| user-today-plan-view-model.test.mjs | 14 | 0 | A396 已有 |
| **user-dashboard-unified-stats-view-model.test.mjs** | **26** | **0** | **A398 新增** |
| **user-dashboard-unified-stats-hydration.test.mjs** | **11** | **0** | **A398 新增** |
| **A398 新增总计** | **37** | **0** | |
| **全量测试总计** | **140** | **0** | |

## 9. Skip 原因

- 不做浏览器手动验收（本轮 spec 明确不要求）
- 不启动 dev server
- 不执行 Prisma migration / generate / db push
- 不调用 LLM
- 不写 DB
- 不修改 Desktop
- 不做阶段压缩

## 10. 安全边界确认

- 未硬编码 API key / token / secret / DATABASE_URL
- 每条统计有 safetyLabel，包含 "未调用 LLM"
- 面板组件显示 source badge + 图例，明确标注数据来源
- UI 文案标注「规则型统计」「客户端本地数据」「localStorage fallback」「dev-only」「未接生产账号」「未调用 LLM」
- 未出现「AI 自动分析」「生产学习报告」「真实云端同步」「真实用户画像」「Agent 已运行」等误导文案
- hydration 组件为 "use client"，不覆盖 server stats value
- 每条 stat safetyLabel 独立检查 FORBIDDEN_LABELS
- AI 问答历史统计 description 包含「安全摘要」，不包含 raw prompt/response
- 未新增公开无保护 API route
- 未修改 Desktop
- 未执行 Prisma migration

## 11. 未完成事项

- 浏览器手动验收（等 Codex 额度恢复后）
- 历史复习推荐持久化（当前仅预览）
- 学习 streak / 学习目标设定 / 周报等新功能

## 12. 下一轮建议

- A399: 浏览器手动验收 A395 错题本 + A396 学习报告/复习/计划 + A397 客户端水合 + 学习中心 + A398 统一面板
- 或 A399: 继续下一个学习业务闭环（如学习目标、周报、streak、每日挑战）

## 13. 项目进度

**约 86.00%**（上一轮 A397: 85.60%，本轮新增统一 stats panel + 37 测试 pass）
