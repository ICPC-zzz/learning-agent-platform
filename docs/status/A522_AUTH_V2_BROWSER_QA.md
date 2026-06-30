# A522 Auth v2 Browser QA

Date: 2026-06-29

## Scope

Browser QA was run against production `next start` for the Auth v2 surfaces that could be exercised without a configured real email provider.

This QA used the in-app Browser plugin. No Desktop route or Desktop code was entered.

## Environment

Production build had already passed:

```bash
pnpm run build
```

Production server was started with:

```bash
pnpm --filter @learning-agent-platform/web start
```

The server responded at:

```text
http://localhost:3000/auth/login
http://127.0.0.1:3000/auth/login
```

The local production server was stopped after QA.

## Desktop Viewport

Viewport:

```text
1440 x 900
```

Checked:

```text
/auth/login
/user
```

Observed:

- `/auth/login` rendered the email OTP login/register entry.
- No visible `dev-session`, `lap-web-dev-session`, `非生产 Auth`, or `dev-only` text was present.
- Layout width matched viewport width: `clientWidth = 1440`, `scrollWidth = 1440`.
- `/user` without `lap_session` redirected to `/auth/login?returnTo=%2Fuser`.
- No Browser console errors or warnings were observed during this check.

## Mobile Viewport

Viewport:

```text
390 x 844
```

Checked:

```text
/auth/login
```

Observed:

- `/auth/login` rendered at mobile width.
- Layout width matched viewport width: `clientWidth = 390`, `scrollWidth = 390`.
- Test email `codex-a522@example.com` could be entered.
- Sending OTP returned:

```text
邮箱验证服务当前不可用。
```

- No visible `dev-session`, `lap-web-dev-session`, `非生产 Auth`, or `dev-only` text was present.
- No Browser console errors or warnings were observed during this check.

## Not Verified

A522 Browser QA did not verify the full real-user Auth v2 path because the current runtime did not have a working production email provider configuration.

Unverified:

- Real email OTP delivery.
- OTP receive and verify in Browser.
- Successful `lap_session` creation observed through Browser login.
- Refresh persistence after login.
- Logout and server-side session revocation through Browser.
- Normal user versus admin role behavior through Browser.
- Two real users A/B data isolation through Browser.
- Admin authorized workflow through Browser.

## Result

Browser QA confirms the non-authenticated production login surface and route guard behavior, but it does not close the full A522 production authentication acceptance criteria.

```text
desktopEntryAllowed = false
```
