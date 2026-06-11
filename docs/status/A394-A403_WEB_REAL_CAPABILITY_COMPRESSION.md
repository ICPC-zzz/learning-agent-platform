# A394–A403 Web 真实能力接入阶段压缩总结

本文件是 A394–A403 跨轮能力接入的压缩总结。覆盖"从学习业务闭环到外部书源预览入口"的完整阶段。后续需要了解 Web 真实能力接入阶段上下文时读取本文，**默认不读**各个原始轮次文档。

**生成时间**: 2026-06-11 (A404 维护轮)

## 1. A394–A398：学习业务闭环与 Dashboard 统计概览

A394–A398 构建了"错题本 → 学习报告/复习/计划 → 每日挑战"的完整 Web 学习闭环：

- **A394**：学习学习面板 Learning Page v1 skeleton（Dashboard 入口卡、学习统计、学习进度）
- **A395**：Problem Wrong Book v1 — 错题本实现（localStorage v1 + DB loader + 客户端水合）
- **A396**：学习报告面板 — 基于本地错题/收藏/练习记录生成确定性学习摘要
- **A397**：复习建议引擎 — 基于错题本 + 最近练习的确定性复习计划
- **A398**：Dashboard stats 统一摘要 — 收藏数/阅读数/导入数/错题数等 13 项统计

安全边界：全部确定性规则，无 LLM、无外部 API、UI 标注"开发预览"。

## 2. A399：Daily Challenge v1

6-tier 确定性推荐引擎，基于 localStorage：

| Tier | 来源 | 条件 |
|------|------|------|
| 1 | wrong-book-needs-review | 待复习错题，最高 wrongCount |
| 2 | wrong-book-high-count | 高错误次数的错题 |
| 3 | favorite-not-recent | 7 天未练习的收藏题目 |
| 4 | recent-practice-needs-review | 最近练习中需复习的 |
| 5 | builtin-date-hash | 日期 DJB2 哈希取模内置题库 |
| 6 | builtin-fallback | SAMPLE_PROBLEMS 第一题 |

- 页面路由：`/daily-challenge`
- 客户端水合：读取 localStorage `lap.web.user.dailyChallenge`，构建 view model
- 集成到 `/learning` 入口卡和 `/user` 用户中心今日计划
- 测试：32 + 19 + 19 = 70 条 pass

## 3. A400：Daily Challenge Persistence + DB Skeleton

- **持久化抽象层**：`daily-challenge-persistence.ts`（localStorage 默认 + DB guarded preview）
- **DB repository v1 skeleton**：`daily-challenge-progress-repository.ts`（无 Prisma model，返回 blocked metadata）
- 3 层 guard：`LAP_DAILY_CHALLENGE_DB_DEV_ENABLED` → `LAP_ALLOW_REAL_DB_INTEGRATION` → `DATABASE_URL`
- 修复了 A399 残留的文件损坏（`user-dashboard-unified-stats-view-model` 截断/空字节）
- 测试：21 + 15 = 36 条 pass

## 4. A401：Daily Challenge Completion Event → LearningActivity DB dev-only write path

核心变更：将 Daily Challenge 完成事件写入真实 DB（LearningActivity 表）：

- `LearningActivityType` 新增 `"daily_challenge_completed"`
- `daily-challenge-progress-repository.ts` V1→V2 升级：从 skeleton 升级为真实 adapter
- 新增 `daily-challenge-activity-sync.ts`：bridge 模块，对接 LearningActivity DB write path
- guard 评估 → localStorage-first → DB fallback → safety metadata 全路径覆盖
- 所有写入默认关闭（需多重 `LAP_*` 显式开启）
- 测试：42 条 pass

## 5. A402：Book Source Provider contract + dev-only HTTP adapter

在 `packages/book-engine` 新增外部书源访问的抽象层：

- `book-source-provider.ts`：contract 接口 + safety metadata helpers + empty result factories
- `dev-http-book-source-provider.ts`：dev-only HTTP adapter，3 层 guard，injectable fetch，AbortController timeout，安全字段提取
- 仅提取已知安全字段（title/authors/description/cover），拒绝 raw response 存储
- 测试：13 + 31 = 44 条 pass

## 6. A403：Open Library dev-only provider + Import 页面外部书源预览入口

- `open-library-book-source-provider.ts`：Open Library API adapter，4 层 guard
- Import 页面新增 `BookApiPreviewClient` 组件：显示外部书源预览入口
- 默认全部 guard 关闭，UI 标注"开发预览"
- 测试：47 条 pass（book-engine）+ import 预览相关测试 68 条 pass

## 7. 当前安全边界

- 所有 DB 写入默认关闭，需多重 `LAP_*` 环境变量显式授权
- 所有外部 API 调用默认禁用，需多层 guard 全开后执行
- 书籍预览不保存 raw API response，仅提取已知安全字段
- AI/LLM 全部 preview-only / mock-only / disabled-by-default
- Desktop 所有面板只读，标注"开发预览"
- 客户端水合仅读取 localStorage 安全摘要

## 8. 当前真实能力落地情况

| 能力 | 状态 | 说明 |
|------|------|------|
| DB：Daily Challenge completion write | dev-only guarded path | 需多重 env var 显式开启 |
| DB：LearningActivity 时间线 | dev-only guarded path | 支持 7+ 种活动类型 |
| 书籍 API：Open Library provider | dev-only guarded preview | Import 页面预览入口已接入 |
| 书籍 API：通用 HTTP adapter | dev-only contract | 可扩展其他 provider |
| LLM：Reader QA external provider | 未接 | 计划 A405 |
| 导入：外部书源真实导入 | 未接 | 仅预览入口 |
| Reader sync auth/session | 未接 | 仍为 no-op |
| Desktop 业务集成 | 未接 | 所有面板只读预览 |

## 9. 未完成风险

- Reader QA external LLM 尚未接入（计划 A405）
- Reader sync 的 auth/session/permission/audit/idempotency 仍是草案
- 导入页面仅展示外部书源预览，未打通真实导入链路
- Web 整链浏览器验收未执行（需启动 dev server）
- Desktop 业务集成未启动

## 10. 后续推荐顺序

1. **A405**：Reader QA External LLM dev-only guarded path v1（5 层 guard + fake fetch 测试全覆盖）
2. Reader sync auth/session/permission/audit/idempotency 真实闭环
3. Import 外部书源预览 → 真实导入草案
4. Web 整链浏览器验收（需切换 Codex 或明确授权）
5. Desktop 业务集成

## 11. 历史文档索引

以下 A394–A403 原始轮次文档保留在 `docs/rounds/codex/`，**不建议默认读取**。需要时按需查阅：

- `docs/rounds/codex/A394_claude.md`
- `docs/rounds/codex/A395_claude.md`
- `docs/rounds/codex/A396_claude.md`
- `docs/rounds/codex/A397_claude.md`
- `docs/rounds/codex/A398_claude.md`
- `docs/rounds/codex/A399_claude.md`
- `docs/rounds/codex/A400_claude.md`
- `docs/rounds/codex/A401_claude.md`
- `docs/rounds/codex/A402_claude.md`
- `docs/rounds/codex/A403_claude.md`

对应 DeepSeek 文档在 `docs/rounds/deepseek/A39x_deepseek.md`。
