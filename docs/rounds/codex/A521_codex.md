# A521 Codex Round

Date: 2026-06-29

## Scope

Fixed the Web production build chain and verified production-mode Browser smoke.

No Auth v2, Scheduler, AI productionization, CF binding, Prisma schema, or Desktop work was performed.

## Original Build Failure

A520 failure:

```text
pnpm run build
ERR_PNPM_NO_SCRIPT
```

Root had no `build` script. Web had no `build/start` scripts.

## Added / Modified Scripts

Root `package.json`:

```json
"build": "pnpm --filter @learning-agent-platform/db build && pnpm --filter @learning-agent-platform/web build"
```

`apps/web/package.json`:

```json
"build": "next build --no-lint",
"start": "next start"
```

## Build Dependency Order

1. `@learning-agent-platform/db build`
2. `@learning-agent-platform/web build`

No Desktop build. No migration. No content sync. No real LLM call.

## Build-Time Environment Handling

- Next loaded `.env.local`.
- No variable values or secrets were printed.
- No secret was hardcoded.
- Optional AI/CF/dev-only capabilities remain preview/dev-only and were not promoted to production.

## Typecheck

Passed:

```bash
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
```

`tsconfig.base.json` was adjusted to remove `verbatimModuleSyntax` while keeping `isolatedModules`, because Next production type validation fails when both are present.

## Production Build

Passed:

```bash
pnpm run build
```

Evidence:

```text
Compiled successfully
Checking validity of types
Generating static pages (39/39)
Finalizing page optimization
Collecting build traces
```

Artifacts:

```text
apps/web/.next
packages/db/dist
```

Note: `next build --no-lint` skips Next's integrated lint phase because current Web lint scope includes broad historical lint debt and test/support files. TypeScript and production compilation still run. This round ran scoped lint on the modified lint config.

## Production Start

Passed:

```bash
pnpm --filter @learning-agent-platform/web start
```

Observed:

```text
Local: http://localhost:3000
Ready
```

## @Browser 调用

Explicitly used the in-app `@Browser` plugin against production `next start`.

Routes checked at `1440 x 900` and `390 x 844`:

```text
/
/articles
/problems
/ai
/user
/auth/login
/auth/register
/not-existing-a521
/admin
```

Each route was loaded and refreshed.

## Desktop Viewport Acceptance

Desktop `1440 x 900` passed for all required routes.

- CSS and fonts loaded.
- WebP loaded on `/`.
- No failed images.
- No hydration/chunk/uncaught fatal console errors.
- No severe horizontal overflow relative to viewport width.
- `/not-existing-a521` rendered 404.
- `/admin` rendered 404 for current non-admin session.

## Mobile Viewport Acceptance

Mobile `390 x 844` passed for all required routes.

- CSS and fonts loaded.
- WebP loaded on `/`.
- No failed images.
- No hydration/chunk/uncaught fatal console errors.
- No severe horizontal overflow relative to viewport width.
- `/not-existing-a521` rendered 404.
- `/admin` rendered 404 for current non-admin session.

## Console Result

No fatal console errors matching hydration, ChunkLoadError, uncaught runtime error, or dynamic import/chunk failure were observed in Browser QA.

## Tests

Passed:

```bash
node --test tests/a515-*.test.mjs
node --test tests/a516-*.test.mjs
node --test tests/a517-*.test.mjs
node --test tests/a518-*.test.mjs
pnpm exec eslint eslint.config.mjs
```

Not run because no files matched:

```bash
tests/a520-*.test.mjs
tests/a521-*.test.mjs
```

## Still Unfinished Web P0/P1

- Auth v2 / production session boundary remains incomplete.
- Browser E2E automation is still missing.
- Admin authorized workflow QA still needs a real admin session.
- Content scheduler/cron remains incomplete.
- AI production provider boundary remains dev-only/preview-only.
- CF account binding/sync production Browser flow remains incomplete.
- Full lint debt cleanup remains out of scope for A521.

## Gate

```text
desktopEntryAllowed = false
```

No `git add`, `git commit`, or `git push` was run.
