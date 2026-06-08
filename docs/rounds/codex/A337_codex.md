# A337 Codex Round Record

## Goal
Add Reader sync idempotency key v1 and wire it into the dev/test-only server action core. Production must stay disabled-by-default. No real auth, no schema/migration change, and no public route.

## Files Changed
- `apps/web/src/app/reader/reader-sync-idempotency-key.ts`
- `apps/web/src/app/reader/reader-sync-idempotency-key.test.mjs`
- `apps/web/src/app/reader/reader-sync-real-server-action-core.ts`
- `apps/web/src/app/reader/reader-sync-real-server-action-core.test.mjs`
- `apps/web/src/app/reader/reader-sync-real-server-action.test.mjs`
- `docs/codex-context/CURRENT_HANDOFF.md`

## What Changed
- Added a pure idempotency key module.
- The key uses only safe fields: `serverUserId`, `bookId`, `chapterId`, `progressRatio`, `source`, and optional `requestedAt`.
- Same safe input produces the same key.
- Changing `chapterId`, `progressRatio`, or `source` changes the key.
- Missing `serverUserId`, `bookId`, or `chapterId`, or an out-of-range `progressRatio`, is blocked.
- Dangerous fields are rejected and never transited.
- The core now validates idempotency after the permission gate and before the test-only fake/dev path.
- When idempotency is blocked, the core stays preview-only and reports `success=false`, `writesDatabase=false`, and `callsRepository=false`.
- Production remains disabled-by-default.

## Verification
- `npm run lint` ✅
- `npm run typecheck` ✅
- `node apps/web/src/app/reader/reader-sync-idempotency-key.test.mjs` ✅
- `node apps/web/src/app/reader/reader-sync-real-server-action-core.test.mjs` ✅
- `node apps/web/src/app/reader/reader-sync-real-server-action.test.mjs` ✅
- `node apps/web/src/app/reader/reader-sync-permission-gate.test.mjs` ✅

## Notes
- No real auth provider was connected.
- No schema or migration was changed.
- No public route was added.
- No default production DB write path was enabled.
- No Desktop/Agent/Skill scope was touched.

## Suggested Next Step
If we continue Reader sync next round, the safest follow-up is a tiny duplicate-submit / conflict handling slice for dev/test-only flows, while keeping the production path disabled.
