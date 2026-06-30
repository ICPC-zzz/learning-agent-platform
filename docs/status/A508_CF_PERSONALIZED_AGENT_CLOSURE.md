# A508 CF Personalized Agent Closure

Date: 2026-06-27

## Scope

This round closes the current Codeforces assistant loop for `/ai`:

- Prefer the latest valid learning report estimated real rating over official Codeforces rating.
- Read candidate problems from the local curated Codeforces pool only.
- Read upcoming contests from the official Codeforces `contest.list` API only.
- Route CF intents deterministically before the LLM provider guard.
- Expose tool evidence in the AI chat response.
- Keep learning reports, review plans, and code-analysis summaries as read-only learning context, not user-managed long-term memory.

No Prisma schema or migration was added. No git add/commit/push was run.

## Implemented

- Added a read-only personalized Codeforces provider:
  - `resolveLearnerTrainingProfileFromSources`
  - `resolveLearnerTrainingProfile`
  - `getPersonalizedCodeforcesCandidates`
  - `getUpcomingCodeforcesContests`
  - deterministic CF intent classification
- Training profile priority:
  - latest valid learning report estimate
  - learning report training range midpoint
  - derived estimate from synced CF stats
  - official rating fallback
  - insufficient data
- Candidate problems:
  - local curated Codeforces pool from DB only
  - solved/completed exclusions through the existing user candidate query
  - weak-tag preference with same-rating fallback
  - no invented CF problem names or links
- Upcoming contests:
  - official `https://codeforces.com/api/contest.list?gym=false`
  - `phase === "BEFORE"` and `startTimeSeconds > now`
  - ascending start time
  - short fresh cache and stale cache fallback
  - no historical contest substitution
- Assistant tools:
  - `resolveLearnerTrainingProfile`
  - `getPersonalizedCodeforcesCandidates`
  - `getUpcomingCodeforcesContests`
- Assistant orchestration:
  - `TRAINING_RECOMMENDATION`
  - `UPCOMING_CONTESTS`
  - `TRAINING_AND_CONTEST_PLAN`
  - `HISTORICAL_USER_CONTESTS`
- Current AI chat response now carries:
  - `usedTools`
  - `sources`
  - `toolTimeline`
  - tool status/source/cache/safety evidence
- Memory UI and service now separate read-only learning artifacts from user-managed long-term memory.

## Safety Notes

- Candidate and contest tools are read-only.
- Tool inputs do not accept client-controlled user identity.
- Upcoming contest tool still goes through the Codeforces external API guard.
- Historical contest intent is explicitly routed without calling upcoming contest data.
- Raw upstream responses are not stored.
- Learning artifacts remain prompt-retrievable context, but are hidden from long-term memory management and counts.

## Verification

Passed:

```powershell
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
node --test tests/a504-tools-runtime.test.mjs tests/a504-plus-memory-contracts.test.mjs tests/a505-context-compression.test.mjs tests/a505-conversation-repository.test.mjs tests/a507-conversation-lifecycle.test.mjs tests/a508-cf-personalized-agent.test.mjs
node --test tests/a508-cf-personalized-agent.test.mjs
```

Real Codeforces API smoke:

- `getUpcomingCodeforcesContests({ limit: 3 })`
- guard env: `LAP_ALLOW_EXTERNAL_PROBLEM_API=1`, `LAP_PROBLEM_API_PROVIDER=codeforces`, `LAP_PROBLEM_API_BASE_URL=https://codeforces.com/api`
- source: `codeforces_api`
- returned 3 future contests
- warnings: none

## Remaining Limits

- Personalized candidate generation requires a configured database and synced Codeforces account data.
- Browser manual verification for `/ai` should still be performed in the user's session.
- This round does not implement historical contest listing.
- This round does not add production DB conversation/artifact tables.
