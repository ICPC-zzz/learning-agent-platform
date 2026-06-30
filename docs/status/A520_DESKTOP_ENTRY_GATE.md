# A520 Desktop Entry Gate

Date: 2026-06-30

## A526 Update

```text
desktopEntryAllowed = false
```

A526 did not open Desktop entry. Local Web completion and server deployment readiness are accepted after user-confirmed manual Browser verification, but real server production verification is still pending Aliyun deployment, HTTPS validation, scheduler installation, and backup restore rehearsal.

## Gate Decision

```text
desktopEntryAllowed = false
```

Web is still not complete enough to enter Desktop development. A525 kept the gate closed.

## Why Desktop Is Still Blocked

1. Real smoke email delivery was not executed because no real recipient mailbox was provided.
2. Real OTP send, receive, and Browser verification are still incomplete.
3. New WebSession creation and `lap_session` cookie inspection after real login are still incomplete.
4. Refresh persistence and service restart persistence are still incomplete.
5. Logout revocation is still incomplete.
6. Admin Browser flow is still incomplete; current database count shows `admins = 0`.
7. Ordinary-user admin rejection after real login is still incomplete.
8. Two-user A/B isolation is still incomplete.
9. Automated browser E2E for the accepted Auth flow is still missing.
10. AI/Agent/Tool/Skill production scope remains preview-only, dev-only, mock, disabled-by-default, or unverified.

## A525 Evidence

Passed:

- `email:doctor`.
- Typecheck for ai-core, db, web, and root.
- Production build.
- A515-A524 tests: `101` passed.
- `/api/health` with database `ok`.
- `@Browser` `/auth/login` smoke at 1440 x 900 and 390 x 844.

Not passed:

- Real Auth closure.
- Server deployment readiness.
- Desktop entry.

## Required Web Exit Criteria Before Desktop

- Complete real email OTP send, receive, and verify with a configured Provider.
- Verify `lap_session` login persistence, restart recovery, and logout revocation in Browser.
- Verify admin routes in Browser with an authorized database-backed admin session.
- Verify ordinary user cannot access admin routes or admin actions.
- Verify two-user A/B isolation for key user-owned data surfaces.
- Add automated browser E2E for accepted Web P0 flows.
- Keep raw prompt/response, secrets, OTPs, and session tokens out of logs and docs.
- Keep Agent/tool/Skill execution gated by permissions, audit logs, and explicit user action.

## Non-Goals For Current Stage

- No `apps/desktop` code changes.
- No Desktop scaffold or UI implementation.
- No autonomous tool execution.
- No production claims for dev-only AI/Agent capabilities.
