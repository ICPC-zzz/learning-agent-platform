# A524 Codex Round

Date: 2026-06-30

## Scope

A524 continued the A524 thread: repair real Resend runtime configuration, keep Auth v2 safe, add deployment readiness assets, and verify as much as possible without reading or printing secrets.

Desktop was not modified.

## Real Failure Root Cause

The true issue was not an unverified Resend domain. The local configuration had split sources:

```text
root .env.local: RESEND_API_KEY present, RESEND_FROM_EMAIL present
apps/web/.env.local: legacy LAP_EMAIL_API_KEY present, LAP_EMAIL_FROM present
system environment before CLI loading: email variables missing
```

The old send action parsed config inline and preferred legacy `LAP_*` values before `RESEND_*`, so a stale app-local legacy config could override the verified Resend config.

After the page still showed `邮件发送服务未配置，请稍后再试。`, A524 reproduced the runtime mismatch from `apps/web` cwd:

```text
apps/web cwd selected LAP_EMAIL_FROM
fromDomain: resend.dev
realSendAllowed: false
blockedReasons: invalid_from_email,unexpected_from_domain
```

The server-side email config now safely falls back to repository-root env files when Next runs from `apps/web`, so the Web runtime also selects the root `RESEND_*` values.

## Actual Environment Variable Source

`pnpm email:doctor` reported, without printing values:

```text
apiKeySource: RESEND_API_KEY
fromSource: RESEND_FROM_EMAIL
fromDomain: auth.cfagent.fun
apiKeyFormat: valid
APP_BASE_URL: missing in checked local/system env
realSendAllowed: true
```

## Provider Switches

Provider config is now centralized in:

```text
apps/web/src/lib/email/email-runtime-config.ts
```

Priority is:

```text
RESEND_API_KEY -> LAP_EMAIL_API_KEY
RESEND_FROM_EMAIL -> LAP_EMAIL_FROM -> EMAIL_FROM
```

The sender domain must be exactly:

```text
auth.cfagent.fun
```

## Sender Address

Expected production sender:

```text
CF Agent <no-reply@auth.cfagent.fun>
```

The config checker rejects unsafe whitespace, wrapping quotes, invalid mailbox format, and wrong domains.

## Resend Safe Response

Resend calls now live in:

```text
apps/web/src/lib/email/resend-provider.ts
```

Only safe summaries are returned:

```text
provider
status
errorCode
requestId
messageId
```

Raw provider responses are not printed or persisted.

## Test Email

Not run. `pnpm email:smoke --to <test-email>` requires an explicit recipient address from the user.

## OTP Email

The OTP template now includes:

```text
CF Agent
验证码
有效时间
非本人操作忽略
不要向他人透露验证码
```

HTML and text versions are both generated. No database ID, session ID, debug path, API key, or internal service path is included.

Real OTP delivery was not run because no recipient mailbox was provided.

## OTP Verification

Source and regression tests confirm:

- OTP success consumes the OTP before creating the session.
- Provider send failure consumes the newly created OTP.
- OTP is not returned in normal responses.
- Production does not fall back to console OTP.

Real OTP verification in Browser was not completed.

## Session Creation

Source and tests confirm:

- Verification creates `WebSession`.
- Cookie name is `lap_session`.
- Cookie is HttpOnly.
- Production cookie is Secure.
- Database stores only the session token hash.
- Cookie does not store user id, email, or role.

Real Browser session creation was not completed.

## Refresh Keep

Not completed in Browser because real OTP verification was not completed.

## Service Restart

Not completed with an authenticated Browser session because real OTP verification was not completed.

## Logout Revocation

Source and tests confirm logout revokes the database session before clearing the cookie.

Real Browser logout revocation was not completed.

## Admin

Source and tests confirm admin authorization comes from database `User.role = ADMIN`, and `pnpm auth:bootstrap-admin` promotes only existing users listed in `LAP_ADMIN_EMAILS`.

Real Browser admin flow was not completed.

## Ordinary User

Source and tests confirm ordinary users cannot pass admin checks by client-side role spoofing.

Real ordinary-user Browser rejection was not completed.

## A/B Isolation

Source and regression tests still cover formal user-owned data boundaries. Real two-mailbox Browser A/B isolation was not completed because no second recipient mailbox was provided.

## Health Check

Added:

```text
apps/web/src/app/api/health/route.ts
```

Verified against production `next start`:

```text
status=200
{"status":"ok","database":"ok","timestamp":"..."}
```

The route does not expose environment variables, database URL, provider key, version details, or internal paths.

## Deployment Files

Added:

```text
deploy/nginx/cfagent.fun.conf.example
deploy/systemd/learning-agent-platform.service.example
deploy/cron/content-sync.example
deploy/scripts/backup-postgres.sh.example
docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md
```

## Nginx

The example proxies:

```text
https://cfagent.fun -> http://127.0.0.1:3000
```

It forwards `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto=https`, and `X-Forwarded-For`.

## systemd

The example uses:

```text
EnvironmentFile=/etc/learning-agent-platform/web.env
WorkingDirectory=/opt/learning-agent-platform
pnpm --filter @learning-agent-platform/web start
```

## Cron

The cron example loads secrets from `/etc/learning-agent-platform/web.env`, uses `flock`, and runs existing content sync commands.

## Database Backup

The backup example uses `pg_dump --format=custom` and retention cleanup. It requires `DATABASE_URL` from the protected environment.

## Typecheck

Passed:

```bash
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
```

## Build

Passed:

```bash
pnpm run build
```

Result:

```text
Compiled successfully
Generating static pages (40/40)
```

## Tests

Passed:

```bash
node --test tests/a515-*.test.mjs tests/a516-*.test.mjs tests/a517-*.test.mjs tests/a518-*.test.mjs tests/a522-*.test.mjs tests/a523-*.test.mjs tests/a524-*.test.mjs
```

Result:

```text
94 tests passed
```

Scoped lint passed for A524 TypeScript files.

## @Browser

Used `@Browser` against a freshly started production `next start`.

Passed:

- `/auth/login` desktop 1440 x 900.
- `/auth/login` mobile 390 x 844.
- No horizontal overflow in either viewport.
- Email input present.
- No Browser console warning/error logs.

Direct Browser navigation to `/api/health` was blocked by the browser client, so health was verified by local HTTP request against the same production server.

## Still Incomplete Web Gates

- Real non-OTP smoke email delivery.
- Real OTP receive and verify.
- Browser login persistence.
- Browser restart recovery.
- Browser logout revocation.
- Admin Browser flow.
- Ordinary-user Browser rejection after real login.
- Two-user Browser A/B isolation.
- Automated E2E.
- Deployment scheduler/timer finalization.
- Real bound-user Codeforces Browser flow.
- Real AI Tool/Skill production boundaries.
- Remaining preview/localStorage/dev-session surfaces outside the formal paths.

## Gate

```text
desktopEntryAllowed = false
```
