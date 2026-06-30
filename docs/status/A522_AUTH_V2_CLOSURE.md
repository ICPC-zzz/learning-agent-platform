# A522 Auth v2 Closure

Date: 2026-06-29

## Result

A522 partially closed the Web Auth v2 foundation:

- Added production database session schema and repository.
- Added `lap_session` HttpOnly cookie flow.
- Replaced OTP verification success path from `lap-web-dev-session` to database-backed `WebSession`.
- Added database RBAC through `User.role = USER | ADMIN`.
- Changed `/admin` authorization to read the authenticated database user role.
- Added controlled admin bootstrap command:

```bash
pnpm auth:bootstrap-admin
```

The command reads `LAP_ADMIN_EMAILS`, promotes only existing users, and records an audit event.

## Database Migration

Added and applied:

```text
packages/db/prisma/migrations/20260629_a522_auth_v2/migration.sql
```

Applied with:

```bash
pnpm --filter @learning-agent-platform/db exec prisma migrate deploy --schema prisma/schema.prisma
```

No `DROP`, `TRUNCATE`, `migrate reset`, or `db push` was used.

## Auth Components

- `User.role` defaults to `USER`.
- `User.disabledAt` blocks future session reads.
- `WebSession.tokenHash` stores only token hash.
- Cookie stores only the raw unpredictable token.
- `AuthAuditEvent` records safe auth event summaries.
- `getCurrentAuthSession()` is the formal server identity entry.
- `requireAuthenticatedUser()` and `requireAdminUser()` are available for protected server code.

## OTP

- OTP remains passwordless email OTP.
- OTP hash storage is retained.
- New OTP request consumes active old OTP records.
- Verification consumes successful OTP.
- Failed attempts are capped at 5.
- Production no longer falls back to console OTP.

## Verification

Passed:

```bash
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
pnpm run build
node --test tests/a515-*.test.mjs tests/a516-*.test.mjs tests/a517-*.test.mjs tests/a518-*.test.mjs tests/a522-*.test.mjs
pnpm exec eslint <A522 scoped source files>
```

Production `next start` was launched and Browser checked login and unauthenticated route guard.

## Not Fully Closed

A522 cannot be declared fully complete yet:

- Current runtime environment returned `邮箱验证服务当前不可用。`, so real email OTP receive/verify was not completed in Browser.
- Browser login, refresh persistence, logout, A/B isolation, and admin authorized workflows were not fully verified.
- Many legacy preview modules still directly read `lap-web-dev-session` or use `userIdPreview`, especially books, reader, import, and user subpages.
- Many localStorage-based learning/report/reader fallback surfaces remain preview-only.

## Desktop Gate

```text
desktopEntryAllowed = false
```

No Git add, commit, or push was run.
