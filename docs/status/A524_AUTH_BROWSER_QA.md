# A524 Auth Browser QA

Date: 2026-06-30

## Scope

Browser QA used `@Browser` against a freshly started production `next start` process.

Viewports:

```text
1440 x 900
390 x 844
```

## Passed Browser Checks

- `/auth/login` loads on desktop.
- `/auth/login` loads on mobile.
- Desktop width matched viewport: `clientWidth = 1440`, `scrollWidth = 1440`.
- Mobile width matched viewport: `clientWidth = 390`, `scrollWidth = 390`.
- Email input is present.
- No Browser console warning/error logs were captured during the login page smoke.

## Health Check

Browser direct navigation to `/api/health` was blocked by the browser client, so the endpoint was verified by local HTTP request against the same production server:

```text
status=200
{"status":"ok","database":"ok","timestamp":"..."}
```

## Blocked Real Auth Checks

The following were not honestly verifiable in this turn because no recipient mailbox and no user-entered OTP were provided:

- Real non-OTP smoke email delivery.
- Real OTP email delivery.
- Real OTP verification.
- Formal session creation observed through Browser login.
- Refresh persistence after login.
- Production service restart recovery with the same session.
- Logout revocation observed through Browser.
- Admin Browser authorization flow after `pnpm auth:bootstrap-admin`.
- Ordinary user rejection from `/admin`.
- Two real users A/B data isolation.

No OTP code was read from database rows, logs, server output, or browser responses.

## Result

A524 Browser QA is partially complete. The production page and health smoke passed, but the real Auth Browser closure remains blocked on user-provided mailbox input.

```text
desktopEntryAllowed = false
```
