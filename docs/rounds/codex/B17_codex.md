# B17 Codex Round - Code Analysis Deployment Recovery

Date: 2026-07-14

## Scope

Repair the code-analysis page failure reported as `An unexpected response was received from the server.` after a production deployment, without changing the accepted problem-rating prompt or the analysis workflow.

## Root Cause

The page retained a Server Action identifier from the previous Next.js build while the server had already switched to a new build. That build-version protocol mismatch is not a model timeout or a code-analysis result; Next.js surfaced its raw English transport error to the user.

The prior deployment also briefly exposed the new release directory before its complete `.next` production build was in place, enlarging the mismatch window.

## Changes

- Added `apps/web/src/app/ai/server-action-recovery.ts`.
  - Recognizes only known Server Action deployment-mismatch messages.
  - Returns a Chinese recovery message and does not classify ordinary model or analysis failures as deployment mismatches.
- Updated `apps/web/src/app/ai/AiAssistantTabs.tsx`.
  - Shows the Chinese recovery message and reloads the current page bundle once when this exact transient mismatch occurs.
  - Does not retry the analysis request automatically, preventing a duplicate model call.
- Added `tests/b017-server-action-deployment-recovery.test.ts`.
  - Covers both mismatch recognition and non-mismatch preservation.

## Verification

```powershell
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web exec node --import tsx --test ../../tests/b014-code-analysis-runtime.test.ts ../../tests/b015-personalized-analysis-concurrency.test.ts ../../tests/b016-code-analysis-and-profile-language.test.ts ../../tests/b017-server-action-deployment-recovery.test.ts
```

Result: typecheck passed; 7 directed tests passed.

## Deployment Rule

For this server, do not run `pnpm install` or `next build` in the live release path. Build an exact commit artifact in an isolated local worktree, upload it to a new release directory, verify its `BUILD_ID`, then change the `current` symlink once and restart the service. The systemd service must start Next.js directly with `NODE_PATH` set to `packages/db/node_modules`; using pnpm as the service entrypoint can trigger a non-interactive dependency reconciliation and make the release unavailable. This keeps the current service available during preparation and avoids the prior CPU spike.
