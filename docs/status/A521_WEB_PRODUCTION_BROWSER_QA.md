# A521 Web Production Browser QA

Date: 2026-06-29

## Setup

Production build was started with:

```bash
pnpm --filter @learning-agent-platform/web start
```

QA used the explicit `@Browser` in-app browser plugin against:

```text
http://localhost:3000
```

Viewports:

```text
1440 x 900
390 x 844
```

Each route was loaded and then reloaded once.

## Routes Checked

| Route | HTTP | Desktop | Mobile | Notes |
| --- | ---: | --- | --- | --- |
| `/` | 200 | Pass | Pass | WebP hero image loaded; minor scrollWidth/clientWidth delta, not beyond viewport. |
| `/articles` | 200 | Pass | Pass | CSS/fonts loaded; no image failures. |
| `/problems` | 200 | Pass | Pass | CSS/fonts loaded; no image failures. |
| `/ai` | 200 | Pass | Pass | UI remains dev-preview/AI assistant surface; no production LLM claim made. |
| `/user` | 200 | Pass | Pass | Dev session/user dashboard loaded. |
| `/auth/login` | 200 | Pass | Pass | Current auth remains dev/OTP-preview boundary. |
| `/auth/register` | 200 | Pass | Pass | Page states no standalone registration; dev-only marker visible. |
| `/not-existing-a521` | 404 | Pass | Pass | Default Next 404 rendered and survived reload. |
| `/admin` | 404 | Pass | Pass | Current non-admin session rejected; no auth bypass performed. |

## Browser Signals

- `readyState`: complete on checked pages after load and reload.
- CSS: stylesheets present on all checked pages.
- Fonts: `document.fonts.status = loaded`.
- Images: `failedImageCount = 0`.
- WebP: `/` reported `webpCount = 1`.
- Next chunks: `_next/static` scripts present.
- Console fatal checks: no hydration, ChunkLoadError, uncaught runtime, or dynamic import fatal logs observed.
- Severe horizontal overflow: none observed relative to viewport width.

## Observations

- The home page reports `scrollWidth > clientWidth` by 7 px desktop and 8 px mobile, but `scrollWidth <= innerWidth`, so it was recorded as a non-severe scrollbar/viewport delta rather than a serious horizontal overflow.
- `/admin` renders 404 for the current non-admin Browser session. This matches the A520 guard expectation and was not bypassed.
- `/not-existing-a521` returns and renders 404 as expected.

## Production Boundary

This QA used `next start`, not `pnpm dev`. No content sync, CF sync, production AI provider call, migration, or Desktop build was executed.

```text
desktopEntryAllowed = false
```
