# A400 — Web Daily Challenge DB dev-only 持久化骨架 v1 + 修复损坏测试

**Model**: Claude Sonnet (Claude Code)
**Mode**: Claude Code (Web learning loop)
**Date**: 2026-06-11

## 1. Modified Files

### Fixed (corruption repair)

- `apps/web/src/app/user/user-dashboard-unified-stats-view-model.ts` — removed trailing null-byte padding
- `apps/web/src/app/user/user-dashboard-unified-stats-view-model.test.mjs` — reconstructed from truncation; 26 tests now pass

### New files

- `apps/web/src/app/daily-challenge/daily-challenge-persistence.ts` — unified persistence abstraction (localStorage default + DB guarded preview)
- `apps/web/src/app/daily-challenge/daily-challenge-persistence.test.mjs` — 21 tests pass
- `packages/db/src/repositories/daily-challenge-progress-repository.ts` — DB repository v1 skeleton (disabled by default, no Prisma model, no DB writes)
- `packages/db/src/repositories/daily-challenge-progress-repository.test.mjs` — 15 tests pass

### Modified files

- `packages/db/src/repositories/index.ts` — added DailyChallengeProgress repository exports
- `packages/db/src/index.ts` — added DailyChallengeProgress type exports and function re-exports

## 2. Corruption Fix

**Root cause**: Both `.ts` and `.test.mjs` files had tool-induced trailing null-byte padding (`\x00` repeat). The test file was additionally truncated — the closing `findStat` function body and `run()` statement were missing.

**Repair method**:
- `.ts`: Stripped trailing null bytes (20986 → 20986 clean bytes)
- `.test.mjs`: Reconstructed the complete file via Python heredoc-free write; verified 26/26 tests pass

## 3. Daily Challenge DB Dev-Only 持久化骨架

### Architecture

```
daily-challenge-persistence.ts (Web layer)
  ├── localStorage (always active, default)
  └── DB repository (guarded, disabled by default)
       └── daily-challenge-progress-repository.ts (DB layer v1 skeleton)
            └── No Prisma model yet — returns blocked metadata always
```

### Guard layers

1. `LAP_DAILY_CHALLENGE_DB_DEV_ENABLED=true`
2. `LAP_ALLOW_REAL_DB_INTEGRATION=true` (project-level global guard)
3. `DATABASE_URL` configured

All three must pass for the DB path to activate. Default: ALL OFF.

### Persistence layer (`daily-challenge-persistence.ts`)

- `createDailyChallengePersistenceStore(dbRepo?)` — factory; when `dbRepo` is null/omitted, localStorage only
- `dailyChallengePersistenceStore` — default singleton with null DB repo
- `isDailyChallengeDbGuardActive()` — safe guard check (handles missing process.env)
- All result objects carry:
  - `source: "localStorage" | "db-dev-preview" | "fallback"`
  - `writesDatabase: boolean`
  - `productionReady: false`
  - `safeToExposeToClient: true`
  - `llmUsed: false`
  - `externalApiUsed: false`

Fallback strategy:
- Load: tries DB → falls back to localStorage on any error
- Save: always writes localStorage first → tries DB → result indicates which layer succeeded
- Clear: clears localStorage always → tries DB clear → ignores DB errors

### DB repository (`daily-challenge-progress-repository.ts`)

v1 skeleton:
- Type contract: `DailyChallengeProgressRepository` with `findByDate`, `upsertProgress`, `clearToday`
- Implementation: all three methods return `{ record: null, metadata: { status: "blocked", ... } }`
- `writesDatabase: false` on all results
- Blocked reasons include: env var check failure, `V1_SKELETON_NO_PRISMA_MODEL` (even when all guards pass)
- Singleton via `getDailyChallengeProgressRepository()`

### No Prisma schema changes

No DailyChallenge model exists in `prisma/schema.prisma`. No migration, no `prisma generate`, no `prisma db push` were executed. The repository is a pure design-document type scaffold.

## 4. 默认是否写 DB

**否。** 默认不写 DB。Guard 未开（`LAP_DAILY_CHALLENGE_DB_DEV_ENABLED` 未设置），repository 返回 skeleton blocked 结果，`writesDatabase: false`，persistence 走 localStorage。

## 5. 是否调用 LLM / 外部 API

**否。** 所有 metadata 标记 `llmUsed: false`、`externalApiUsed: false`。未调用任何 LLM provider，未调用外部书籍 API。

## 6. Fallback 策略

| 场景 | 行为 |
|------|------|
| Guard 未开 | localStorage 直接读写 |
| Guard 已开 + DB 正常 | DB → 返回 `db-dev-preview` |
| Guard 已开 + DB 异常/无记录 | localStorage → 返回 `fallback` |
| Guard 已开 + DB 写失败 | localStorage 写入 → 返回 `fallback`（含 dbError） |
| localStorage JSON 损坏 | 已有校验自动清空损坏 key |

## 7. Test Results

| Test file | Pass | Fail | Notes |
|-----------|------|------|-------|
| user-dashboard-unified-stats-view-model.test.mjs | 26 | 0 | repaired from truncation/null-byte |
| daily-challenge-rules.test.mjs | 19 | 0 | A399 existing |
| daily-challenge-view-model.test.mjs | 19 | 0 | A399 existing |
| local-daily-challenge-store.test.mjs | 32 | 0 | A399 existing |
| user-today-plan-view-model.test.mjs | 14 | 0 | A399 existing |
| daily-challenge-progress-repository.test.mjs | 15 | 0 | A400 new |
| daily-challenge-persistence.test.mjs | 21 | 0 | A400 new |
| **A400 new** | **36** | **0** | |
| **Total regression** | **110** | **0** | all A399 + A400 tests pass |

## 8. lint/typecheck Results

- **Lint**: PASS (0 errors)
- **Typecheck**: PASS (0 errors)

## 9. 与现有集成保持兼容

- `/daily-challenge` 状态可用 — 仍直接使用 localStorage store
- `/user` Dashboard — 仍然通过 A399 的 localStorage hydration 读取 DC 状态
- `/learning` 入口 — 不变
- `/user/today` — 不变
- DB guard 未开启时不抛错
- localStorage-only 环境功能完全正常

## 10. Skip Reasons

- No Prisma migration / schema change (no DailyChallenge model exists yet)
- No dev server start
- No browser/GUI verification
- No LLM calls
- No DB writes
- No Desktop modifications
- No external API calls

## 11. Safety Boundary Confirmation

- No API key / token / secret / DATABASE_URL value exposed
- All guard blocked reasons reference env var NAMES only, not values
- All metadata has `safeToExposeToClient: true`
- All metadata has `productionReady: false`
- All metadata has `llmUsed: false`
- All metadata has `externalApiUsed: false`
- No "AI 自动推荐" or other forbidden production labels

## 12. Unfinished Items

- 浏览器手动验收 A395–A400 整链
- Daily Challenge streak tracking
- Weekly challenge variation

## 13. Next Round Suggestions

- A401: 浏览器手动验收 A395–A400 整链（错题本 → 学习报告/复习/计划 → 每日挑战 → 持久化边界）
- A401 alternative: 进阶下一个学习业务闭环（学习目标设定 / 周报 / streak 跟踪）
- 未来 A4xx: 当需要真实 DB 时，先加 DailyChallenge 模型到 schema.prisma + migration，再实现 repository adapter

## 14. Project Progress

**~87.00%**（previous: 86.50%, +0.50% for DB dev-only 持久化骨架 + 损坏测试修复 + 36 new tests）
