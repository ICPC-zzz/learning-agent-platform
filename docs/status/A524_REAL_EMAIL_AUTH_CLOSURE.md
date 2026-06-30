# A524 Real Email Auth Closure

Date: 2026-06-30

## Result

A524 is code-complete for Resend runtime configuration and server deployment readiness, but the real Auth Browser closure is not honestly complete yet.

Closed in code:

- Centralized email runtime config in `apps/web/src/lib/email/email-runtime-config.ts`.
- Corrected provider priority:

```text
RESEND_API_KEY -> LAP_EMAIL_API_KEY
RESEND_FROM_EMAIL -> LAP_EMAIL_FROM -> EMAIL_FROM
```

- Enforced sender domain validation for `auth.cfagent.fun`.
- Moved Resend HTTP calls and OTP email templates into `apps/web/src/lib/email/resend-provider.ts`.
- OTP send now uses the centralized provider module.
- Provider failure still consumes the newly created OTP and records only a safe audit error summary.
- Added `pnpm email:doctor` and `pnpm email:smoke --to <test-email>`.
- Added `/api/health`.

Not closed:

- No user-provided recipient mailbox was available in this turn, so `pnpm email:smoke --to ...` was not run.
- No real OTP mailbox receive/verify was completed.
- Browser login persistence, restart recovery, logout revocation, admin Browser flow, and two-user A/B Browser isolation remain unverified.

## Root Cause

The true runtime risk found in A524 was configuration source and priority drift:

- Repository root `.env.local` contains `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- `apps/web/.env.local` contains legacy `LAP_EMAIL_API_KEY` and `LAP_EMAIL_FROM`.
- System environment did not contain the email variables before CLI loading.
- The old action-local parser gave legacy `LAP_*` variables priority over `RESEND_*`.

A524 fixed the code priority and added a doctor command that reports source and domain safely without printing secrets.

After the UI still showed `邮件发送服务未配置，请稍后再试。`, the runtime was rechecked from `apps/web` cwd. That reproduced the issue safely:

```text
apps/web cwd selected LAP_EMAIL_FROM
fromDomain: resend.dev
realSendAllowed: false
blockedReasons: invalid_from_email,unexpected_from_domain
```

The server-side config now loads repository-root env fallbacks, so Next running from `apps/web` also selects `RESEND_*` from the root env file.

## Safe Environment Summary

From `pnpm email:doctor`:

```text
.env.local: RESEND_API_KEY present, RESEND_FROM_EMAIL present
apps/web/.env.local: LAP_EMAIL_API_KEY present, LAP_EMAIL_FROM present
system environment before CLI loading: email variables missing
apiKeySource: RESEND_API_KEY
fromSource: RESEND_FROM_EMAIL
fromDomain: auth.cfagent.fun
apiKeyFormat: valid
APP_BASE_URL: missing in checked local/system env
realSendAllowed: true
```

No API key, database URL, token, session cookie, or OTP value was printed.

## Resend Safe Response

Real provider smoke was not run because no explicit `--to` address was provided.

The new provider captures only:

```text
provider=resend
status=<status or none>
errorCode=<safe code>
requestId=<safe request id or none>
messageId=<safe id on success>
```

It does not persist or print raw provider responses.

## Validation

Passed:

```bash
pnpm email:doctor
node --test tests/a515-*.test.mjs tests/a516-*.test.mjs tests/a517-*.test.mjs tests/a518-*.test.mjs tests/a522-*.test.mjs tests/a523-*.test.mjs tests/a524-*.test.mjs
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
pnpm run build
pnpm exec eslint apps/web/src/lib/email/email-runtime-config.ts apps/web/src/lib/email/resend-provider.ts apps/web/src/app/auth/login/email-otp-actions.ts apps/web/src/app/api/health/route.ts scripts/email-env-loader.ts scripts/email-doctor.ts scripts/email-smoke.ts
```

Regression result:

```text
94 tests passed
typecheck 0 errors
production build passed, 40/40 static pages generated
```

## Desktop Gate

```text
desktopEntryAllowed = false
```
