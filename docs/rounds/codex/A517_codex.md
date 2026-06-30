# A517 Codex Round

Date: 2026-06-28

## 改动

- 新增 `DailyContentSyncState` schema 与非破坏性迁移，用于内容同步状态和 DB lease。
- 新增 `syncDailyHotTopics()`、`syncGithubDailyReport()`、`syncAllDailyContent()` 共享 job。
- 新增 CLI scripts：`content:sync:hot`、`content:sync:github-daily`、`content:sync:all`。
- `/articles` 在配置数据库时优先读取 DB 快照；无 DB 或读取失败时降级 JSON。
- 最近阅读七天过滤下沉到 `PrismaArticleRepository.listArticleReadingsByOwner({ since })`。
- Codeforces 意图拆分为 A517 明确枚举，比赛推荐不再调用候选题工具。
- 更新旧“先提醒刷新报告”长期记忆语义为 freshness 检查和自动刷新语义。
- A513 tool injection 测试适配前置训练画像解析。

## 验证

通过：

```powershell
node --test tests/a512-*.test.mjs
node --test tests/a513-*.test.mjs
node --test tests/a515-*.test.mjs
node --test tests/a516-*.test.mjs
node --test tests/a517-*.test.mjs
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm run typecheck
npx eslint <本轮 touched scoped files>
```

迁移 SQL 已检查无 `DROP` / `TRUNCATE` / `DELETE FROM`。

## 未完成

- 未执行真实 DB migration。
- 未运行真实 Codeforces 网络 smoke。
- 未做浏览器完整验收。
- 学习报告、复习计划、代码分析只完成意图/freshness 层修正，未完整接入 Skill。

## 风险

- 当前工作区已有大量非本轮未提交改动，本轮没有回滚或覆盖。
- 内容同步状态表需要执行 migration 后才能在真实数据库生效。
- 部署平台 cron 仍需下一轮按部署环境接入。

## 项目总进度

31.00%。本轮补齐部分真实业务链路，但仍有多项 A517 真实验收和 Skill 接入未完成。
