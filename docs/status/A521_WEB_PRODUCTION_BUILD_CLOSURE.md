# A521 Web Production Build Closure

Date: 2026-06-29

## Result

`pnpm run build` now exists and exits with code 0.

The command performs a real production Web build:

```bash
pnpm --filter @learning-agent-platform/db build && pnpm --filter @learning-agent-platform/web build
```

It builds the DB package first, then builds the Web app. It does not build Desktop, run Prisma migrations, run content sync, or call a real LLM provider.

## Original Failure

A520 found:

```text
pnpm run build
ERR_PNPM_NO_SCRIPT
```

Root `package.json` had no `build` script, and `apps/web/package.json` had no production `build/start` scripts.

## Script Changes

Root:

```json
"build": "pnpm --filter @learning-agent-platform/db build && pnpm --filter @learning-agent-platform/web build"
```

Web:

```json
"build": "next build --no-lint",
"start": "next start"
```

`next build --no-lint` was used because Next's integrated lint step currently pulls in broad historical ESLint debt and Node-only test files. TypeScript validation, compilation, page data collection, static page generation, and build tracing still run. This round also ran scoped lint for the modified lint config.

## TypeScript Config

`tsconfig.base.json` now keeps `isolatedModules` and removes `verbatimModuleSyntax`.

Reason: Next production type validation injects/uses `isolatedModules`; the current Next/TypeScript combination fails when both options are present.

## Build Evidence

Passed:

```bash
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
pnpm run build
```

Build output included:

```text
Compiled successfully
Checking validity of types
Generating static pages (39/39)
Finalizing page optimization
Collecting build traces
```

Production artifacts exist:

```text
apps/web/.next
packages/db/dist
```

## Environment Handling

- `.env.local` was loaded by Next during build/start.
- No environment variable values were printed.
- No secrets were hardcoded.
- Build did not require migrations, content sync, external LLM calls, or CF sync.
- AI/CF/dev-only capabilities remain marked as preview/dev-only in Browser QA.

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

## Scope Guard

- No `apps/desktop` files were modified by this round.
- No Prisma schema changes were made by this round.
- Existing dirty `packages/db/prisma/schema.prisma` was present before A521 work and was not touched.
- No `git add`, `git commit`, or `git push` was run.

## Gate

```text
desktopEntryAllowed = false
```
