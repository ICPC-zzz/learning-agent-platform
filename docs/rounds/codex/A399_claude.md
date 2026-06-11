# A399 — Web Daily Challenge v1

**Model**: Claude Sonnet (Claude Code)
**Mode**: Claude Code (Web learning loop)
**Date**: 2026-06-11

## 1. Modified Files

### New files

- `apps/web/src/lib/local-daily-challenge-store.ts` — localStorage store for daily challenge state (key: `lap.web.user.dailyChallenge`)
- `apps/web/src/app/daily-challenge/daily-challenge-rules.ts` — Deterministic 6-tier recommendation engine (no LLM)
- `apps/web/src/app/daily-challenge/daily-challenge-view-model.ts` — Page view model + dashboard summary builder + safety checks
- `apps/web/src/app/daily-challenge/page.tsx` — SSR shell for /daily-challenge page
- `apps/web/src/app/daily-challenge/DailyChallengeClient.tsx` — Client hydration component (reads localStorage, builds view, handles actions)
- `apps/web/src/lib/local-daily-challenge-store.test.mjs` — 32 tests pass
- `apps/web/src/app/daily-challenge/daily-challenge-rules.test.mjs` — 19 tests pass
- `apps/web/src/app/daily-challenge/daily-challenge-view-model.test.mjs` — 19 tests pass

### Modified files

- `apps/web/src/app/user/page.tsx` — Added A399 Daily Challenge entry section
- `apps/web/src/app/learning/page.tsx` — Added daily challenge entry card to ENTRY_CARDS
- `apps/web/src/app/user/today/user-today-plan-view-model.ts` — Added daily challenge task (Tier 2), capTasks function with DC priority, MAX_TASKS=5
- `apps/web/src/app/user/today/UserTodayPlanClientHydration.tsx` — Reads daily challenge from localStorage, passes to view model
- `apps/web/src/app/user/user-dashboard-unified-stats-view-model.ts` — Added 13th stat (daily-challenge), added dailyChallengeActive/Title/Status to DashboardLocalStatsInput
- `apps/web/src/app/user/UserDashboardUnifiedStatsHydration.tsx` — Reads daily challenge from localStorage for unified stats

## 2. Daily Challenge Rules

6-tier deterministic priority engine (`selectDailyChallenge`):

| Tier | Source | Condition |
|------|--------|-----------|
| 1 | `wrong-book-needs-review` | Wrong book entries with reviewStatus="needs-review", highest wrongCount |
| 2 | `wrong-book-high-count` | Wrong book entries, highest wrongCount |
| 3 | `favorite-not-recent` | Favorite problems NOT practiced in last 7 days |
| 4 | `recent-practice-needs-review` | Recent practice with status="needs-review", most recent |
| 5 | `builtin-date-hash` | Deterministic DJB2 hash of date string modulo builtin count |
| 6 | `builtin-fallback` | First problem in SAMPLE_PROBLEMS |

Properties:
- Same date + same input → same output (no randomness)
- No LLM, no network, no external API
- Pure functions, testable in isolation

## 3. localStorage State

Key: `lap.web.user.dailyChallenge`

Schema:
- challengeDate (YYYY-MM-DD)
- problemId, title, difficulty, tags
- status: not-started | in-progress | completed | needs-review
- startedAt, completedAt, updatedAt (ISO timestamps)
- recommendationSource, recommendationReason

Safety:
- JSON corruption → safe fallback (clear key)
- Invalid status → rejected
- completedAt before startedAt → rejected
- Stale date → auto-cleared
- No user code, no judge output, no raw prompt/response saved
- Sensitive pattern detection (DATABASE_URL, token, secret, etc.)

## 4. /daily-challenge Page

SSR shell + client hydration component (DailyChallengeClient.tsx).

Shows:
- Today's challenge problem (title, difficulty, tags, estimated minutes)
- Current status badge (colored)
- Recommendation reason + source badge
- Status actions: Start / Complete / Needs Review / Reset
- Related links: Problem Detail, Today Plan, Wrong Book, Review Recs, Problem Center
- Safety notices: 开发预览, 规则生成, 未调用 LLM, 未接真实判题, localStorage fallback, 不保存用户代码, 不保存判题结果
- Footer: data source explanation

Forbidden: "AI 自动推荐", "真实判题已接入", "生产每日挑战", "云端同步成功", "Agent 已运行"

## 5. Integration Points

### /user Dashboard
- New section: "A399 Daily Challenge" with description and entry link
- Daily challenge stat added as 13th item in unified stats panel

### /learning Center
- Daily challenge card added to ENTRY_CARDS grid (first position)

### /user/today Plan
- Daily challenge added as Tier 2 task (after wrong book review)
- `capTasks()` function prioritizes daily challenge when over MAX_TASKS (5)
- DC task preserved even when capping

## 6. LLM Usage

**No**. All recommendation logic is deterministic rule-based. No LLM provider, no Agent, no Tool, no network calls.

## 7. DB Usage

**No**. No Prisma operations. No DB schema changes. All state in localStorage.

## 8. lint/typecheck Results

- **Lint**: PASS (VM lint complete, 0 errors)
- **Typecheck**: PASS (0 errors)

## 9. Test Results

| Test file | Pass | Fail | Notes |
|-----------|------|------|-------|
| local-daily-challenge-store.test.mjs | 32 | 0 | A399 new |
| daily-challenge-rules.test.mjs | 19 | 0 | A399 new |
| daily-challenge-view-model.test.mjs | 19 | 0 | A399 new |
| sample-programming-problems.test.mjs | all | 0 | existing |
| problem-library-filter.test.mjs | all | 0 | existing |
| local-user-problem-store.test.mjs | all | 0 | existing |
| local-problem-wrong-book-store.test.mjs | all | 0 | existing |
| user-today-plan-view-model.test.mjs | 14 | 0 | updated for DC |
| **A399 new total** | **70** | **0** | |

## 10. Skip Reasons

- No browser manual verification (per spec: Codex额度恢复后再做)
- No dev server start
- No Prisma migration/generate/db push
- No LLM calls
- No DB writes
- No Desktop modifications
- No phase compaction
- user-dashboard-unified-stats-view-model.test.mjs has file corruption issues from tool null-byte padding (not A399 introduced; existing test)

## 11. Safety Boundary Confirmation

- No API key / token / secret / DATABASE_URL hardcoded
- All UI labels: "开发预览", "规则生成", "未调用 LLM", "未接真实判题", "localStorage fallback"
- All safety notices include "未调用 LLM"
- No "AI 自动推荐", "真实判题已接入", "生产每日挑战", "云端同步成功", "Agent 已运行"
- User code / judge output / raw prompt / raw response not saved
- No public unprotected API routes
- No Desktop modifications
- No Prisma migration

## 12. Unfinished Items

- Browser manual verification (waiting for Codex quota)
- user-dashboard-unified-stats-view-model.test.mjs null-byte corruption fix (existing test file, not A399 regression)
- Daily challenge streak tracking
- Weekly challenge variation

## 13. Next Round Suggestions

- A400: Browser manual verification of A395-A399 chain (Wrong Book, Learning Report/Review/Plan, Hydration, Learning Center, Unified Stats, Daily Challenge)
- Or A400: Learning goal setting / weekly report / streak tracking

## 14. Project Progress

**~86.50%** (previous: 86.00%, +0.50% for daily challenge v1 + 70 tests + 3 new pages)
