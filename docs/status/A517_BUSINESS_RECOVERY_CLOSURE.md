# A517 Business Recovery Closure

Date: 2026-06-28

## A516 回归结果

- `node --test tests/a515-*.test.mjs tests/a516-*.test.mjs` 通过。
- A512/A513 canonical Tool Runtime 回归通过。
- 权限拒绝注入路径已继续保留在 A513 browser injection 测试中。

## 权限拒绝

- `tool_permission_denied_once` 仍通过 canonical runtime 映射为安全中文权限拒绝状态。
- Timeline 不暴露 raw prompt、raw tool I/O、stack trace、credential。

## 每日热点同步

- 新增共享 job：`syncDailyHotTopics()`。
- 同步状态写入 `DailyContentSyncState`。
- 支持成功快照新鲜度检查、DB lease 跳过并发、失败保留旧数据。

## GitHub 日报同步

- 新增共享 job：`syncGithubDailyReport()`。
- 复用现有 GitHub provider 和 `syncGitHubDailyReport()` 业务实现。
- 每日成功快照未过期时跳过重复同步。

## Scheduler 与补偿

- 新增 CLI：
  - `pnpm content:sync:hot`
  - `pnpm content:sync:github-daily`
  - `pnpm content:sync:all`
- Admin 手动同步改为调用同一份 job。
- 尚未接入真实部署平台 cron；本轮提供服务端 job + CLI + admin 触发入口。

## 收藏数据库持久化

- 复用现有 `ArticleFavorite` / `PrismaArticleRepository`。
- 本轮未改变收藏清理策略；收藏不受七天最近阅读过滤影响。

## 最近阅读七天规则

- `ListArticleReadingsByOwnerInput` 新增 `since`。
- 最近阅读 loader 将七天 cutoff 下沉到 Repository 查询条件。

## Prisma 迁移

- 新增非破坏性迁移 `20260628_a517_daily_content_sync_state`。
- SQL 只包含 `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS`。
- 已检查不包含 `DROP` / `TRUNCATE` / `DELETE FROM`。
- 未执行 `prisma db push` 或 `migrate reset`。

## Timeline 折叠入口

- A516 已有刷新恢复和可展开详情回归。
- 本轮未重写 Timeline UI，只修正 A513 注入测试以适配“先解析画像，再执行业务工具”的链路。

## 意图路由

- Codeforces 意图拆为：
  - `contest_recommendation`
  - `problem_recommendation`
  - `training_plan`
  - `learning_report`
  - `review_plan`
  - `code_analysis`
  - `cf_profile_refresh`
  - `historical_user_contests`
- “推荐一场适合我的 Codeforces 比赛”只走比赛推荐，不走候选题。

## Codeforces API Tool

- 继续复用现有 `getUpcomingCodeforcesContests`，经 canonical Tool Runtime 执行。
- 比赛推荐输出来自官方 `contest.list` 或短期缓存。

## 学习报告 Tool/Skill

- 本轮仅更新 freshness 记忆语义，没有实现完整刷新 Skill。

## 复习计划 Tool/Skill

- 本轮仅更新 freshness 记忆语义，没有实现完整刷新 Skill。

## 代码分析 Skill

- 本轮只补意图分类枚举，没有接入完整 code analysis Skill。

## freshness

- 长期记忆旧规则被新语义 supersede：先检查新鲜度，新鲜则直接用，过期则 Agent 自动刷新，只有自动刷新失败才提醒用户。

## 自动刷新

- 内容同步 job 支持自动/CLI/admin 调用。
- 学习报告、复习计划、CF 快照自动刷新仍未完整接入。

## 数据库 upsert

- 内容快照继续使用 `DailyContentItem` upsert。
- 同步状态使用 `DailyContentSyncState` upsert。
- 最近阅读继续使用 `ArticleReading` upsert。

## 长期记忆 supersede

- `extractExplicitLongTermMemory()` 对旧“先提醒刷新报告”规则返回新 freshness 规则文本。
- 新测试覆盖不再保留“先提醒用户刷新”的旧 active 文案。

## 真实浏览器验收

- 本轮未启动 `pnpm dev` 做完整浏览器验收。

## 用户仍需复验

- 使用本地真实数据库执行迁移后，手动触发 `pnpm content:sync:all`。
- 打开 `/articles` 验证 DB 快照显示更新时间。
- 打开 `/ai` 输入原始比赛推荐句，验证只返回比赛推荐。

## 未实现

- 部署平台 cron。
- 完整学习报告 refresh Skill。
- 完整复习计划 refresh Skill。
- 完整代码分析 Skill 接入。
- 真实 Codeforces API smoke。
- A517 全场景浏览器验收。

## 未验证

- 真实 DB migration 执行。
- 真实外部 Codeforces 网络 smoke。
- `pnpm dev` 浏览器交互。
