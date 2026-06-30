# A526 Multi-User Isolation

Date: 2026-06-30

## Result

Real two-user Browser isolation was completed by user manual Browser verification after the Codex automated pass.

```text
multiUserIsolationClosed = true
```

## Verified By Source And Tests

- A522-A524 contracts confirm user-owned article, Codeforces, assistant conversation, memory, and high-risk user subpages resolve identity from trusted server session state.
- A523 contracts confirm clients cannot submit `role` or owner user ids to core user-data actions.
- A526 Playwright verifies unauthenticated protected routes redirect to `/auth/login`.

## User-Confirmed Browser Verification

- Database contains two distinct email users.
- User B used the second real mailbox through the Browser OTP flow.
- B did not have the admin entry.
- B was rejected by `/admin` and `/admin/sync`.
- A/B isolation was checked by the user and reported as passed.

Codex did not read OTP values, cookie raw values, or session tokens.

## Gate

Dual-user isolation is accepted for the local Web gate based on user-confirmed manual Browser verification plus source and automated contract coverage.
