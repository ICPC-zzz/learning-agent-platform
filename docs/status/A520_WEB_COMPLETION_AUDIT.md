# A520 Web Completion Audit

Date: 2026-06-29

## Hard Result

Web is not complete. Desktop development remains blocked.

`desktopEntryAllowed = false`

## What Was Audited

- Source boundaries: auth/session, admin auth, content sync, Codeforces sync, AI provider guard, user dashboard, app shell, Agent preview.
- Runtime state: DB migrations, content sync commands, real Codeforces API smoke, real external LLM provider smoke.
- Browser state: main Web routes at desktop/tablet/mobile sizes using the in-app Browser.
- Tests: package typechecks, root typecheck, A515-A518 node tests, E2E test discovery, root build script.

## Findings

### P0 Blockers

1. Production auth is not complete.
   - Current session cookie is `lap-web-dev-session`.
   - Session mode remains `dev-only`.
   - Email OTP can map to a real `User`, but the final production session/RBAC boundary is missing.

2. Production build gate is missing.
   - `pnpm run build` fails at root with `ERR_PNPM_NO_SCRIPT`.
   - `apps/web/package.json` also does not provide a verified production build script.

3. Browser E2E automation is missing.
   - No Playwright/Cypress/spec/e2e suite was found.
   - Current Browser QA is manual scripted evidence, not a committed regression suite.

4. Admin workflow is not fully Browser-verified.
   - `/admin` and `/admin/sync` correctly returned 404 for the current non-admin Browser session.
   - Full admin sync/settings/import workflows still require an admin session QA pass.

5. Desktop entry remains blocked.
   - Agent runtime, tools, memory, Skill, safety audit, report/review flows, and stronger main Agent planning should be recorded as Desktop direction only.
   - No Desktop implementation should start before the Web blockers are closed.

### P1 Gaps

- Content sync has working CLI/admin-triggered jobs, but no deployment-neutral scheduler/cron route.
- Codeforces is real-dev capable, but Browser verification used an unbound dev Alpha user; ownership verification is not final.
- AI can call a real external provider in dev mode, but it is explicitly `devOnly` / not production-ready.
- `/not-existing-a520` uses the default Next 404 page.
- Learning and Agent routes are still preview/dev-only surfaces, not production learning/agent loops.
- Multi-user isolation is supported by server user IDs in many paths but not fully Browser-proven in this round.

## Runtime Evidence

### Content Sync

Commands completed:

```bash
pnpm run content:sync:hot -- --force
pnpm run content:sync:github-daily -- --force
pnpm run content:sync:articles -- --force
```

Observed results:

- Hot topics: fetched 80, deduplicated 79, saved 79.
- GitHub daily: fetched 38 repositories, saved 38.
- Articles: current 1911 articles, 45 newly saved.
- DB daily counts after sync included `GITHUB_REPOSITORY = 119` and `TECH_HOTSPOT = 284`.

### Codeforces

Real external smoke succeeded after setting the required external API gate in-process:

- Handle: `IPIC_ZYT`.
- `user.info`: success, rating 1260.
- `user.status`: success, one-page smoke fetched 100.
- `user.rating`: success, 8 rating entries.
- `contest.list`: success, 2126 contests.
- DB refresh: success, 1131 submissions fetched, 350 problem stats upserted, 8 rating changes, 500 recent submissions retained.

### AI Provider

External provider config resolved with required base URL/auth/model present. The real provider smoke returned successfully and identified itself as dev-only. Browser `/ai` also sent a short UI prompt and displayed a real answer with `AI REAL`.

Production caveat: this is still guarded by `LAP_*` environment flags and is not production-ready.

## Test Evidence

Passed:

```bash
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
node --test tests/a515-*.test.mjs
node --test tests/a516-*.test.mjs
node --test tests/a517-*.test.mjs
node --test tests/a518-*.test.mjs
```

Additional focused checks after A520 fixes:

```bash
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web exec eslint src/app/agent/page.tsx src/app/_components/AuthenticatedHome.tsx src/app/_components/AppSidebar.tsx
```

Known failures/gaps:

```bash
pnpm run build
```

fails because no root `build` script exists.

No committed Playwright/Cypress/E2E tests were found.

## A520 Fixes Applied

- Optimized home knowledge-map asset from PNG to WebP and updated the home image source.
- Fixed `/agent` mobile overflow by allowing preview panels, badges, values, and buttons to wrap.
- Added root `overflow-x: clip` to prevent the shared off-canvas sidebar from expanding document scroll width.

## Conclusion

Web has meaningful real-dev capability, but it is not production complete. Desktop entry remains forbidden.
