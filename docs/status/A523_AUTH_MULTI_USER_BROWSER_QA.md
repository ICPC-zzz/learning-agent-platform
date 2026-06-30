# A523 Auth Multi-User Browser QA

Date: 2026-06-30

## Scope

Browser QA used `@Browser` against production `next start`.

Viewports:

```text
1440 x 900
390 x 844
```

## Passed Browser Checks

- `/auth/login` loads on desktop.
- `/auth/login` loads on mobile.
- Login page has no visible `lap-web-dev-session` or `dev-session` text.
- Desktop width matched viewport: `clientWidth = 1440`, `scrollWidth = 1440`.
- Mobile width matched viewport: `clientWidth = 390`, `scrollWidth = 390`.
- `/user` without `lap_session` redirects to `/auth/login?returnTo=%2Fuser`.
- OTP form controls are present and unique.
- Sending OTP with missing Provider config returns a safe unavailable state.
- No visible 6-digit OTP was exposed in the Browser page.
- Browser console had no captured warning/error logs during the checked flow.

## Blocked Browser Checks

The following were not honestly verifiable because no real email Provider was configured in this runtime:

- Real OTP email delivery.
- Real OTP receive.
- Real OTP verification.
- Formal session creation observed through Browser login.
- Refresh persistence after real login.
- Production service restart recovery.
- Logout revocation observed through Browser.
- Admin Browser authorization flow.
- Ordinary user rejection from `/admin` after real login.
- Two real users A/B data isolation through Browser.

## Source-Level Coverage Added

Added:

```text
tests/a523-email-provider.test.mjs
tests/a523-auth-browser-contract.test.mjs
tests/a523-session-lifecycle.test.mjs
tests/a523-user-isolation.test.mjs
tests/a523-admin-auth-flow.test.mjs
tests/a523-production-fallback-removal.test.mjs
```

These cover provider config, OTP failure cleanup, session lifecycle, DB RBAC, source-level user isolation, and formal-path fallback removal.

## Result

A523 Browser QA is partially complete. The only Browser blocker is external email Provider configuration and real mailbox access.

```text
desktopEntryAllowed = false
```
