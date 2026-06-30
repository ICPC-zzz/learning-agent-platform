# A520 Web Capability Matrix

Date: 2026-06-29

Scope: Web-only full completion audit. `apps/desktop` was not touched.

## Verdict

`desktopEntryAllowed = false`

Web is usable for several real-dev workflows, but it is not complete enough to enter Desktop development. The blocking gaps are production authentication/session hardening, root build script, deployment-neutral schedulers, automated browser E2E, full admin workflow QA under an admin session, and removal of remaining preview/dev-only boundaries.

## Capability Matrix

| Area | Status | Evidence | Remaining gap |
| --- | --- | --- | --- |
| Home `/` | PARTIAL_READY | Browser loaded at desktop/tablet/mobile; hero image now uses optimized WebP asset. | User-facing shell still relies on dev auth/session labels. |
| Auth `/auth/login`, `/auth/register` | PARTIAL_REAL_DEV_ONLY | Email OTP actions create/find real `User` records and write a session cookie. Browser pages render. | Session cookie is `lap-web-dev-session`; `sessionMode` is `dev-only`; no production session provider/RBAC/passwordless hardening. |
| Admin `/admin`, `/admin/sync` | GUARDED_BUT_NOT_BROWSER_VERIFIED | Current non-admin Browser session returns 404, proving the guard blocks access. Server-side sync commands work. | Need admin-session Browser QA for full admin workflows; env allowlist is not final RBAC. |
| Articles `/articles` | REAL_DEV_READY | Real content from hot/GitHub/article sync rendered; tab switch to GitHub Daily worked; favorite toggle changed to `★已收藏`; `/user` reflected favorite via current dev fallback. | Local fallback still appears for non-real dev session; admin scheduler still missing. |
| Content sync | REAL_DEV_READY | `content:sync:hot`, `content:sync:github-daily`, and `content:sync:articles` completed successfully with prior snapshots preserved by design. | No deployment-neutral cron/scheduler route; sync is CLI/admin-triggered. |
| Problems `/problems` | PARTIAL_READY | Browser showed 2,000 Codeforces problem pool, pagination, links. | No full local judging/problem detail completion; external API gate depends on env. |
| Codeforces account/data | REAL_DEV_READY | Real CF smoke for bound handle `IPIC_ZYT`: `user.info`, `user.status`, `user.rating`, `contest.list`, and DB refresh all succeeded. | Browser session is dev Alpha and unbound; binding lacks true ownership verification. |
| User dashboard `/user` | PARTIAL_READY | Browser showed favorites/recent reading and Codeforces bind panel; favorite from Articles was visible. | Current Browser session reports local fallback and Codeforces unbound. Multi-user DB isolation not fully Browser-verified. |
| AI `/ai` | REAL_DEV_ONLY | Browser UI sent a short prompt and displayed `AI REAL`; server-side provider smoke returned successfully through configured external provider. | Provider is explicitly dev-only: external tools and LLM are guarded by `LAP_*`; not production-ready; no raw prompt/response persistence by design. |
| Agent `/agent` | PREVIEW_ONLY | Browser route renders safety/readiness preview. Mobile horizontal overflow fixed in A520. | No real Agent execution on Web; future Desktop Agent must reuse Web/server providers and safety boundaries. |
| Learning `/learning` | PREVIEW_PARTIAL | Browser renders without mobile overflow. | Still mixed with localStorage/dev-preview flows; not an audited production learning loop. |
| 404 / unknown route | PARTIAL | `/not-existing-a520` returns Next default 404. | Needs branded/custom not-found experience if Web is considered polished. |
| Responsive shell | PARTIAL_READY | Rechecked `/articles` desktop/mobile and `/agent` mobile after fixes: no horizontal overflow. | Needs automated regression coverage. |
| Build/test gate | BLOCKED | Typechecks and A515-A518 node tests pass. Prisma migrations are up to date. | Root `pnpm run build` fails because no `build` script exists; no Playwright/Cypress E2E tests found. |

## Web Completion Classification

- Completed enough for real-dev validation: Articles content sync/read/favorite, Codeforces provider smoke, AI provider smoke, AI UI answer, core route rendering.
- Not completed for production Web: Auth/session, admin browser workflows, build script, scheduler, E2E, final 404, dev-only provider flags.
- Desktop must remain gated until these P0/P1 gaps are closed.
