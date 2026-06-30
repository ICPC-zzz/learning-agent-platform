# A523 Email OTP Auth Closure

Date: 2026-06-30

## Result

A523 is partially complete.

Closed in code:

- Resend email OTP provider config now accepts `LAP_EMAIL_API_KEY` or `RESEND_API_KEY`.
- Sender address config now accepts `LAP_EMAIL_FROM`, `RESEND_FROM_EMAIL`, or `EMAIL_FROM`.
- A complete Resend provider config enables the real email path without requiring the old dev-console fallback switch.
- Provider send failure immediately consumes the newly created OTP record and records a safe audit failure.
- Production responses still do not return OTP codes.
- Production logs still do not print OTP codes.
- OTP verification still creates a formal `WebSession` and `lap_session` HttpOnly cookie.
- Logout still revokes the database session before clearing the cookie.

Not closed:

- Real email delivery and real OTP receive/verify were not completed because this local runtime has no configured email Provider variables in `.env`, `.env.local`, or `.env.example` before this round.
- No real mailbox OTP was received, so refresh persistence, restart recovery, admin browser flow, and A/B browser data isolation could not be fully verified with real users.

## Provider Root Cause

The A522 browser failure (`邮箱验证服务当前不可用。`) was caused by missing runtime email Provider configuration and a too-narrow sender variable parser.

A523 fixed the code-side parser and failure cleanup. The remaining blocker is external configuration:

```text
RESEND_API_KEY missing
RESEND_FROM_EMAIL missing
EMAIL_FROM missing
LAP_EMAIL_API_KEY missing
LAP_EMAIL_FROM missing
LAP_EMAIL_AUTH_ENABLED missing
APP_BASE_URL missing
```

Only variable presence was checked. No secret values were printed or committed.

## Validation

Passed:

```bash
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
pnpm run build
node --test tests/a515-*.test.mjs tests/a516-*.test.mjs tests/a517-*.test.mjs tests/a518-*.test.mjs tests/a522-*.test.mjs tests/a523-*.test.mjs
pnpm exec eslint <A523 scoped source files>
```

Regression result:

```text
76 tests passed
```

Browser smoke with `@Browser` against production `next start` passed for:

- `/auth/login` desktop 1440 x 900.
- `/auth/login` mobile 390 x 844.
- Unauthenticated `/user` redirect to `/auth/login?returnTo=%2Fuser`.
- OTP request with missing provider returns safe unavailable state and does not expose a 6-digit code.

## Desktop Gate

```text
desktopEntryAllowed = false
```
