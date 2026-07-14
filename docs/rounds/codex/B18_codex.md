# B18 Codex Round - Code Analysis JSON Reliability

Date: 2026-07-14

## Scope

Repair the repeated production code-analysis failure without changing the accepted problem-rating prompt. Preserve Chinese user-facing output and deploy without building on the low-resource server.

## Production Evidence and Root Cause

The latest failed production report completed in about 90 seconds, so this occurrence was not a request timeout. Its code-analysis model call ended after about 73 seconds with an unparseable JSON response.

The failure came from three connected defects:

- The code-analysis runtime reduced the configured 4096-token model output budget to 2048 tokens, which is too small for the full structured report schema.
- A response explicitly marked `finish_reason: length` was parsed before truncation was checked. Incomplete JSON was therefore misclassified as ordinary invalid JSON and triggered a second full model call with the same insufficient limit.
- The personalized report discarded the base analysis error, leaving the UI to display a misleading generic timeout or Provider message.

## Changes

- Raised the bounded code-analysis output allowance from 2048 to 4096 tokens.
- Detect output truncation before JSON parsing and skip the ineffective JSON-repair call in that case.
- Preserve safe base-analysis failure metadata in personalized reports, with backward compatibility for saved reports.
- Show the real Chinese failure reason instead of guessing that every failure is a timeout or Provider outage.
- Set the example Nginx upstream timeout to 210 seconds, above the application's 180-second personalized-analysis budget.
- Added regression coverage for output allowance, truncation handling, duplicate-call prevention, and error propagation.

The problem-rating prompt and rating-estimation behavior were not modified.

## Verification

```powershell
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web exec node --import tsx --test ../../tests/b014-code-analysis-runtime.test.ts ../../tests/b015-personalized-analysis-concurrency.test.ts ../../tests/b016-code-analysis-and-profile-language.test.ts ../../tests/b017-server-action-deployment-recovery.test.ts ../../tests/b018-code-analysis-json-reliability.test.ts
```

Result: both package typechecks passed; 10 directed regression tests passed.

## Deployment Rule

Build the exact committed revision in an isolated local worktree and upload only the verified `.next` artifact to a new release directory. Do not run dependency installation or a Next.js build on the production server. Preserve the persistent report-data directory, switch the `current` symlink atomically, and roll back the symlink if health checks fail.
