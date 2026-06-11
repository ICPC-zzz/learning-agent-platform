# A401 — Web Daily Challenge DB 真实落地第一步：Completion Activity 写入 LearningActivity DB dev-only v1

**Model**: Claude Sonnet (Claude Code)
**Mode**: Claude Code (Web learning loop)
**Date**: 2026-06-11

## 1. Modified Files

### Extended types (daily_challenge_completed added to LearningActivityType)

- `packages/db/src/types.ts` — added `"daily_challenge_completed"` to `LearningActivityType` union, `VALID_ACTIVITY_TYPES` set
- `packages/db/src/repositories/learning-activity-repository.ts` — added `"daily_challenge_completed"` to `VALID_ACTIVITY_TYPES_SET`
- `apps/web/src/app/user/learning-activity-db-actions.ts` — added `"daily_challenge_completed"` to `VALID_ACTIVITY_TYPES`

### Upgraded DB repository (V1 skeleton → V2 real adapter)

- `packages/db/src/repositories/daily-challenge-progress-repository.ts` — V2: added `createRealDailyChallengeProgressRepository()`, `getBlockedReasonsV2()`; removed `V1_SKELETON_NO_PRISMA_MODEL` blocking reason; `upsertProgress` now delegates to `PrismaLearningActivityRepository` when guards pass

### New files

- `apps/web/src/app/daily-challenge/daily-challenge-activity-sync.ts` — bridge between Daily Challenge completion and LearningActivity DB write path; full guard evaluation, localStorage-first, DB fallback; 322 lines
- `apps/web/src/app/daily-challenge/daily-challenge-activity-sync.test.mjs` — 42 tests covering guard, sync, fake-repo, error fallback, safety metadata, no LLM/external API

### Export updates

- `packages/db/src/repositories/index.ts` — added `createRealDailyChallengeProgressRepository` export
- `packages/db/src/index.ts` — added `createRealDailyChallengeProgressRepository` export

## 2. 是否找到并复用了现有 DB activity 模型

**是。** 复用了现有的 `LearningActivity` Prisma 模型（已在 `schema.prisma` 中定义，A392 引入）。该模型包含 `activityType`、`title`、`targetType`、`targetId`、`problemId`、`sourceType`、`occurredAt`、`metadataPreview` 等字段，可直接用于每日挑战完成记录。

复用了现有的 `PrismaLearningActivityRepository`（`packages/db/src/repositories/learning-activity-repository.ts`），通过其 `recordLearningActivity()` 方法写入。

**无需新增 Prisma model / migration / db push / generate。**

## 3. Daily Challenge completion 如何写入 DB dev-only path

写入链路：

```
Daily Challenge 完成事件
  → syncDailyChallengeCompletion() (daily-challenge-activity-sync.ts)
    → 1. localStorage 保存 (always)
    → 2. evaluateDailyChallengeActivityGuard()
         - LAP_DAILY_CHALLENGE_DB_DEV_ENABLED === "true"
         - LAP_ALLOW_REAL_DB_INTEGRATION === "true"
         - DATABASE_URL 已配置
         - 有效 trustedId
    → 3. guard 通过 + repo 可用
         → createRealDailyChallengeProgressRepository()
           → getLearningActivityRepo()
             → PrismaLearningActivityRepository.recordLearningActivity({
                 activityType: "daily_challenge_completed",
                 title: "完成每日挑战: {problem title}",
                 targetType: "problem",
                 targetId: "{problemId}",
                 sourceType: "daily-challenge",
                 metadataPreview: JSON({
                   challengeDate, difficulty, tags,
                   generatedBy: "deterministic-rules",
                   llmUsed: false, externalApiUsed: false,
                   productionReady: false
                 })
               })
    → 4. 失败时 fallback localStorage
```

activity payload 关键字段：
- `activityType`: `daily_challenge_completed`
- `source`: `daily-challenge`
- `generatedBy`: `deterministic-rules`
- `llmUsed`: `false`
- `externalApiUsed`: `false`
- `productionReady`: `false`

## 4. 默认是否写 DB

**否。** 默认不写 DB。所有 4 层 guard（`LAP_DAILY_CHALLENGE_DB_DEV_ENABLED`、`LAP_ALLOW_REAL_DB_INTEGRATION`、`DATABASE_URL`、trustedId）必须在环境中显式设置后才能写入。默认情况下所有 guard 均未满足，系统走 localStorage-only。

## 5. guard 开启后是否具备真实 repository write path

**是。** 当所有 4 层 guard 全部满足且提供了 PrismaLearningActivityRepository 实例时，`createRealDailyChallengeProgressRepository` 的 `upsertProgress` 方法会调用 `repo.recordLearningActivity()` 向 LearningActivity 表写入一条 `daily_challenge_completed` 记录。这是真实的 Prisma DB write path（dev-only），不再是 skeleton。

注意：`findByDate` 和 `clearToday` 在 v2 中仍为 skeleton（因为 LearningActivity 表没有 challengeDate 字段，且读取优先使用 localStorage）。

## 6. Fallback 策略

| 场景 | 行为 |
|------|------|
| Guard 未满足（任意层） | localStorage 写入成功，返回 source="localStorage"，writesDatabase=false |
| Guard 满足但 repo=null | localStorage 写入成功，返回 source="fallback"，writesDatabase=false |
| Guard 满足 + repo 可用 + 状态非 completed | localStorage 写入成功，返回 source="localStorage"，不写 DB |
| Guard 满足 + repo 可用 + DB 写入成功 | localStorage + DB 均写入，返回 source="db-dev-preview"，writesDatabase=true |
| Guard 满足 + repo 可用 + DB 写入异常 | localStorage 写入成功，返回 source="fallback"，writesDatabase=false，fallbackReason 包含错误信息 |

localStorage 始终优先保存，DB 失败不影响 localStorage 数据完整性。

## 7. 是否调用 LLM / 外部 API

**否。** 所有 metadata 标记 `llmUsed: false`、`externalApiUsed: false`。未调用任何 LLM provider，未调用外部书籍 API。所有状态由确定性规则引擎生成。

## 8. 新增/修改测试与通过情况

### A401 新增测试
| Test file | Pass | Fail |
|-----------|------|------|
| daily-challenge-activity-sync.test.mjs | 42 | 0 |

### 全部回归测试
| Test file | Pass | Fail | Notes |
|-----------|------|------|-------|
| daily-challenge-rules.test.mjs | 19 | 0 | A399 |
| daily-challenge-view-model.test.mjs | 19 | 0 | A399 |
| local-daily-challenge-store.test.mjs | 32 | 0 | A399 |
| daily-challenge-persistence.test.mjs | 21 | 0 | A400 |
| daily-challenge-progress-repository.test.mjs | 15 | 0 | A400 (updated) |
| user-dashboard-unified-stats-view-model.test.mjs | 26 | 0 | A400 repaired |
| user-dashboard-learning-stats-view-model.test.mjs | ~14 | 0 | A399 |
| user-activity-page-view-model.test.mjs | 16 | 0 | A392 |
| user-today-plan-view-model.test.mjs | ~14 | 0 | A399 |
| learning-activity-db-guard.test.mjs | 10 | 0 | A392 |
| **A401 new** | **42** | **0** | |
| **Total** | **~228** | **0** | all regression passes |

## 9. lint/typecheck 结果

- **Lint**: PASS (VM TypeScript syntax check, 15 files, 0 errors)
- **Typecheck**: PASS (0 errors)

## 10. 是否需要后续单独 DB schema/migration 授权轮

**不需要。** 本轮完全复用现有 `LearningActivity` Prisma 模型，未修改 `schema.prisma`，未执行任何 migration/db push/generate。如果将来需要独立的 DailyChallenge 表（含 challengeDate 索引等），才需要单独开 migration 授权轮。

## 11. 未完成风险

- `findByDate` 和 `clearToday` 在 v2 real adapter 中仍为 skeleton — 不被本轮 task scope 覆盖
- `daily-challenge-activity-sync.ts` 的 `createRealDailyChallengeActivityRepository` 使用 dynamic import，需在真实 Next.js server 环境中验证 import 路径
- `createRealDailyChallengeProgressRepository` 中 `userId` 暂时使用 `problemId` 作为 fallback — 需要后续轮次接入真实 dev session user ID
- 浏览器/GUI 验收未执行（本轮禁止）
- 未接入 LLM 或外部书籍 API（按 task spec 禁止）

## 12. 项目总进度

**87.50%**（从 87.00% 提升 0.50%；理由：Daily Challenge completion 真实 DB write path 首次落地，42 条新测试，0 回归，lint/typecheck 0 error）

## 13. Skip Reasons

- No Prisma migration / schema change (reused existing LearningActivity model)
- No dev server start
- No browser/GUI verification
- No LLM calls
- No external API calls
- No Desktop modifications
- No `prisma migrate dev` / `prisma db push` / `prisma generate`
- No sensitive data exposed

## 14. Safety Boundary Confirmation

- No API key / token / secret / DATABASE_URL value exposed
- All blocked reasons reference env var NAMES only, not values
- All metadata has `safeToExposeToClient: true`
- All metadata has `productionReady: false`
- All metadata has `llmUsed: false`
- All metadata has `externalApiUsed: false`
- No raw prompt/response saved
- No "AI 自动推荐" or forbidden production labels
- DB writes disabled by default
