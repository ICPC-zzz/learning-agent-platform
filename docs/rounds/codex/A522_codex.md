# A522 Codex Round

Date: 2026-06-29

## Scope

Implemented the Web Auth v2 foundation:

- Email OTP login/register path backed by database users.
- Database-backed Web sessions.
- HttpOnly cookie session token.
- Database RBAC through `User.role`.
- Server identity helpers for authenticated and admin routes.
- Focused tests for session, OTP, RBAC, route guard, and source-level user isolation checks.

Out of scope:

- Desktop.
- Scheduler.
- E2E framework creation.
- Git add, commit, push, reset, restore, stash, or clean.

## Starting Auth State

Before A522:

- Login verification wrote the dev cookie `lap-web-dev-session`.
- Admin access was based on environment allowlists plus dev session identity.
- There was no `WebSession` table.
- `User` had no database role field.
- Several Web surfaces still read dev cookie or preview/localStorage identity directly.

## Database Migration

Added:

```text
packages/db/prisma/migrations/20260629_a522_auth_v2/migration.sql
```

Schema additions:

- `UserRole` enum: `USER`, `ADMIN`.
- `User.role`, default `USER`.
- `User.disabledAt`.
- `WebSession` table with hashed token storage, expiry, revocation, and last-seen fields.
- `AuthAuditEvent` table for safe auth event summaries.

Applied with:

```bash
pnpm --filter @learning-agent-platform/db exec prisma migrate deploy --schema prisma/schema.prisma
```

No destructive database command was used.

## Session Storage

Formal session cookie:

```text
lap_session
```

Cookie properties:

- `HttpOnly`.
- `SameSite=Lax`.
- `Secure` only when `NODE_ENV=production`.
- Path `/`.
- Seven-day max age.

The cookie stores only the raw random session token. The database stores only the SHA-256 hash.

## Identity Entry

Added formal server identity helpers in:

```text
apps/web/src/lib/session/web-auth-session.ts
```

Primary helpers:

- `getCurrentAuthSession()`.
- `requireAuthenticatedUser()`.
- `requireAdminUser()`.
- `createDatabaseSessionForUser()`.
- `revokeCurrentSession()`.

Disabled users and expired or revoked sessions are rejected during session reads.

## OTP Security

Email OTP remains passwordless:

- OTP values are hashed before storage.
- Requesting a new OTP consumes active old OTP records for the same email and purpose.
- Successful verification consumes the OTP.
- Failed verification attempts are capped.
- Production does not fall back to console OTP.

In the current runtime, real OTP delivery was unavailable because the email provider configuration was missing or unavailable.

## DB RBAC

Admin authorization now uses database role:

```text
User.role = ADMIN
```

The request-time admin path no longer authorizes via `LAP_ADMIN_EMAILS` or `LAP_ADMIN_USER_IDS`.

Added bootstrap command:

```bash
pnpm auth:bootstrap-admin
```

The command reads `LAP_ADMIN_EMAILS`, promotes only existing users, and records an auth audit event. It does not create admin users.

## User Isolation

Several user-facing server actions and loaders now use the formal database session user id:

- User dashboard.
- Article favorites server action.
- Article recent reading server action.
- Codeforces dashboard/action entry.
- AI and learning page login-state entry.
- Home dashboard loader.

Source-level tests check that key A522 actions no longer use `lap-web-dev-session` or `userIdPreview` as their authority.

Important limitation: legacy preview modules remain in books, reader, import, learning/report, and other subpages. A522 did not remove every localStorage or dev-session fallback across the entire Web app.

## Browser QA

Used the in-app Browser plugin against production `next start`.

Passed checks:

- `/auth/login` loads on desktop and mobile.
- No visible dev-session copy on the login surface.
- `/user` redirects unauthenticated users to `/auth/login?returnTo=%2Fuser`.
- No fatal Browser console errors observed during the checked Auth surfaces.
- No severe horizontal overflow in checked desktop or mobile login surfaces.

Blocked checks:

- Browser OTP send returned `邮箱验证服务当前不可用。`
- Real email receive/verify was not completed.
- Browser login persistence, logout, two-user A/B isolation, and admin authorized workflow were not completed.

Detailed QA record:

```text
docs/status/A522_AUTH_V2_BROWSER_QA.md
```

## Validation

Passed:

```bash
pnpm --filter @learning-agent-platform/db prisma:generate
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm run typecheck
pnpm run build
node --test tests/a522-*.test.mjs
node --test tests/a515-*.test.mjs tests/a516-*.test.mjs tests/a517-*.test.mjs tests/a518-*.test.mjs tests/a522-*.test.mjs
pnpm exec eslint <A522 scoped source files>
```

Regression result:

```text
51 tests passed
```

Production build result included:

```text
Compiled successfully
Generating static pages (39/39)
```

## Completion Status

A522 is partially closed.

Closed:

- Auth v2 schema and migration.
- Database session token infrastructure.
- HttpOnly cookie write/read/revoke path.
- OTP verification handoff to database session.
- Database role-based admin authorization.
- Admin bootstrap command.
- Focused tests and production build.
- Basic Browser route guard and login surface smoke.

Not closed:

- Real Browser OTP receive/verify.
- Browser refresh persistence and logout revocation.
- Browser normal/admin workflow verification.
- Browser A/B user isolation verification.
- Full removal of legacy dev-session/localStorage fallback across all Web modules.

## Gate

```text
desktopEntryAllowed = false
```

No `git add`, `git commit`, or `git push` was run.
