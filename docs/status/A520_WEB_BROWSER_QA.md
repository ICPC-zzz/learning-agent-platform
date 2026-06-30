# A520 Web Browser QA

Date: 2026-06-29

Browser: in-app Browser plugin against existing local Web server on `http://127.0.0.1:3110`.

## Summary

`desktopEntryAllowed = false`

Browser QA confirms the main Web surfaces are usable in real-dev mode, and A520 fixed the confirmed horizontal overflow regressions. Browser QA also confirms key incompleteness: admin routes are blocked for the current non-admin session, user dashboard falls back to local dev storage, and several pages remain preview/dev-only.

## Route Results

| Route | Viewports | Result |
| --- | --- | --- |
| `/` | 1440, 1024, 390 | Rendered; optimized WebP hero asset loaded. |
| `/articles` | 1440, 390 | Rendered real synced content counts; no overflow after A520 fix. |
| `/problems` | 1440, 1024, 390 | Rendered Codeforces problem pool and pagination. |
| `/user` | 1024, 390 | Rendered dashboard; article favorite visible; Codeforces panel unbound for current Browser session. |
| `/ai` | 1024, 390 | Rendered AI workspace; sent short prompt; displayed real answer with `AI REAL`; no overflow. |
| `/auth/login` | 1024, 390 | Rendered login page. |
| `/auth/register` | 1024, 390 | Rendered register page. |
| `/admin` | 1024 | Returned 404 for current non-admin Browser session. |
| `/admin/sync` | 1024 | Returned 404 for current non-admin Browser session. |
| `/agent` | 390 | Initially overflowed; fixed and rechecked with no overflow. |
| `/learning` | 390 | Rendered without overflow; still preview/localStorage-oriented. |
| `/not-existing-a520` | 1024 | Default Next 404 page. |

## Interactions Verified

### Articles

- Loaded `/articles`.
- Switched to `GitHub 日报`.
- Verified synced GitHub Daily content appeared.
- Clicked `收藏文章`.
- Button changed to `★已收藏`.
- Opened `/user`; the favorited `expo/expo` item appeared in the user dashboard.

Caveat: current Browser session reports "未登录 dev session" and stores this favorite in browser local fallback, not final production user storage.

### AI

- Loaded `/ai`.
- Confirmed existing persisted session list renders.
- Sent a short A520 UI smoke prompt.
- UI showed the prompt, assistant reply, `AI REAL`, page context, and memory panel.

Caveat: provider is real-dev only and guarded by environment flags. This is not production AI readiness.

### Admin

- Loaded `/admin` and `/admin/sync`.
- Both returned 404 under the current Browser session.

Interpretation: the guard blocks non-admin access. This does not prove admin workflows work in Browser; an admin-session QA pass is still required.

## Responsive Fix Verification

Before A520:

- `/agent` at 390px had horizontal overflow (`scrollWidth` 464).
- `/articles` could report overflow after shared off-canvas nav state.

After A520:

- `/agent` at 390px: `bodyScrollWidth = 375`, `docScrollWidth = 375`, overflow false.
- `/articles` at 390px: `bodyScrollWidth = 375`, `docScrollWidth = 375`, overflow false.
- `/articles` at 1440px: `bodyScrollWidth = 1425`, `docScrollWidth = 1425`, overflow false.

## Remaining Browser QA Gaps

- Admin workflow QA under a real admin session.
- Multi-user Browser QA with two real users and DB-backed favorites/conversations.
- Codeforces bind/sync QA through Browser under a real user session.
- Committed Playwright/Cypress regression suite.
- Branded 404 page validation after implementation.
