# A519 Follow-up UI Fix QA

Date: 2026-06-29

## Scope

- Rebuilt the authenticated home page as a dense learning dashboard matching the selected C direction.
- Added a generated bitmap logo asset and replaced the temporary `L` logo in the header, sidebar, and login entry.
- Wired home cards to existing routes so the homepage is no longer a static visual-only page.
- Added a server-side home dashboard loader backed by existing user, article, learning artifact, and Codeforces snapshot repositories.
- Changed Codeforces home visualizations to use synced public Codeforces data snapshots:
  - submission heatmap from recent submissions
  - rating curve from rating history
  - weak-tag review plan from problem stats and learning artifacts
- Moved the Problems page to a single-column order: contest panel first, then problem library.
- Changed the AI assistant page layout to single column to remove the long-left/short-right imbalance.

## Assets

- Logo: `apps/web/public/a519/learning-agent-logo.png`
- Existing hero map: `apps/web/public/a519/academic-knowledge-map.png`

## Browser QA

QA screenshots:

- `docs/status/a519-followup-qa-screenshots/desktop-home.png`
- `docs/status/a519-followup-qa-screenshots/desktop-problems.png`
- `docs/status/a519-followup-qa-screenshots/desktop-ai.png`
- `docs/status/a519-followup-qa-screenshots/mobile-home.png`
- `docs/status/a519-followup-qa-screenshots/mobile-problems.png`
- `docs/status/a519-followup-qa-screenshots/mobile-ai.png`
- viewport crops: `desktop-home-viewport.png`, `mobile-home-viewport.png`

Results:

- Desktop 1536px: `/`, `/problems`, `/ai` have no horizontal overflow.
- Mobile 390px: `/`, `/problems`, `/ai` have no horizontal overflow.
- Homepage renders 8 dashboard cards and 5 animated learning-map nodes.
- Problems first panel is Codeforces contest information, followed by the data boundary and problem pool.
- AI assistant grid computes to one column on desktop and mobile.
- Browser console error logs were empty for the checked pages.

## Verification

- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm exec eslint src/app/page.tsx src/app/home-dashboard-loader.ts src/app/_components/AuthenticatedHome.tsx src/app/_components/AppHeader.tsx src/app/_components/HomeLoginEntry.tsx src/app/_components/AppSidebar.tsx src/app/problems/page.tsx`

## Notes

- The homepage reads the existing server-side Codeforces snapshot. It does not call the Codeforces API directly during every render.
- After a user binds and refreshes Codeforces data from the personal page, the homepage updates on the next dynamic render.
- If no Codeforces account or learning report exists yet, cards show explicit empty states instead of fake personal stats.

## 2026-06-29 Second Follow-up

Additional fixes after visual review:

- Added `首页` to the primary user navigation and verified it is active on `/`.
- Added `HomeHeroOrbit`, a Canvas animation layer over the existing hero knowledge-map asset.
- Reworked the Codeforces learning profile card with a rating band, rank color treatment, weak-tag progress rows, and denser stat chips.
- Reworked the rating chart with grid lines, an area fill, contest dots, axis labels, and latest-contest caption data when rating history exists.
- Reworked the Codeforces heatmap into a week-based calendar grid with totals and a contribution-style legend.
- Fixed mobile title wrapping by splitting the headline into two semantic segments.

Second follow-up Browser QA:

- Desktop 1536px `/`: `首页` nav is active, hero Canvas is mounted, no horizontal overflow, no browser console errors.
- Mobile 390px `/`: headline is fixed at two lines, hero Canvas is mounted, 56 heatmap cells render, no horizontal overflow, no browser console errors.
- Screenshots:
  - `docs/status/a519-followup-qa-screenshots/desktop-home-v3.png`
  - `docs/status/a519-followup-qa-screenshots/desktop-home-v3-viewport.png`
  - `docs/status/a519-followup-qa-screenshots/mobile-home-v3.png`
  - `docs/status/a519-followup-qa-screenshots/mobile-home-v3-viewport.png`

## 2026-06-29 Third Follow-up

Additional fixes:

- Removed the table-like divider lines from the four hero metrics.
- Removed the separate hero-map image and Canvas from the right-side visual container.
- Promoted the knowledge-map image and Canvas animation into a full-page ambient background layer.

Browser QA:

- Desktop 1536px `/`: hero metric borders compute to `0px`, ambient Canvas is present, right-side visual container no longer contains its own image/Canvas, no horizontal overflow, no browser console errors.
- Screenshot: `docs/status/a519-followup-qa-screenshots/desktop-home-v4-final-viewport.png`

## 2026-06-29 Fourth Follow-up

Additional fixes:

- Increased the homepage ambient animation visibility:
  - more particles
  - stronger orbit strokes
  - brighter central pulse
  - visible sweep arcs
  - stronger scan light
- Reduced the whitening overlay that previously made the animation too subtle.
- Kept the ambient layer `pointer-events: none` so it remains a non-interactive background and does not block links.

Browser QA:

- Desktop 1536px `/`: ambient Canvas opacity is `0.94`, background image opacity is `0.48`, metric borders remain `0px`, no horizontal overflow, no browser console errors.
- Screenshot: `docs/status/a519-followup-qa-screenshots/desktop-home-v5-animation-viewport.png`

Verification:

- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm exec eslint src/app/_components/HomeHeroOrbit.tsx`

## 2026-06-29 Fifth Follow-up

Additional fixes:

- Unified the learning-map node default states: `阅读`、`比赛`、`今日训练`、`AI 总结`、`复习` now all use the same white background by default.
- Added hover/focus/active selected effects for the learning-map nodes.
- Changed the `技术文章与日报` card to display latest article-library titles instead of reusing user favorites/recent readings.
- Changed the homepage user reading snapshot to read favorites and recent readings directly for the current server-side session user.
- Removed the 7-day cutoff for homepage recent readings so older latest records can still appear.

Browser QA:

- Desktop 1536px `/`: all 5 map nodes compute to the same white default background, technical article card renders 4 article-library title rows, no horizontal overflow, no browser console errors.
- Current local browser session has no article user-state records, so the user-state card correctly reports the current dev session has no records rather than showing the previous DB guard error.
- Screenshot: `docs/status/a519-followup-qa-screenshots/desktop-home-v7-articles-map-viewport.png`

Verification:

- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm exec eslint src/app/home-dashboard-loader.ts src/app/user/article-recent-reading-db-loader.ts src/app/_components/AuthenticatedHome.tsx`

## 2026-06-29 Sixth Follow-up

Additional fixes:

- Fixed the homepage `收藏与最近阅读` empty-state mismatch with `/user`.
- Added `HomeArticleStateCard`, a client-side homepage card that merges browser localStorage article favorites/recent readings with server DB records.
- Added `HomeRecentReadingMetric`, so the hero `最近阅读` metric also reflects browser-local recent readings after hydration.
- Kept `技术文章与日报` as article-library titles only; user favorites/recent readings remain isolated to `收藏与最近阅读`.

Root cause:

- The `/user` page already displayed browser-local fallback records from `lap.web.user.favoriteArticles` and `lap.web.user.recentArticleReading`.
- The homepage card was server-rendered from DB-only records, so a dev browser session with local fallback data could show records on `/user` but `0 条` on `/`.

Browser QA:

- Current automation browser initially had no local article state, so I verified through the real UI path:
  - clicked a daily hotspot favorite button and confirmed the homepage card rendered `收藏与最近阅读1 条`.
  - clicked a daily hotspot `原文` link and confirmed the homepage hero metric rendered `1最近阅读`.
  - confirmed the homepage card rendered both the local favorite and recent reading before removing the temporary favorite through the UI.
- Final checked homepage state after cleanup: card still rendered the recent reading from browser-local recent history.
- Learning-map node defaults still compute to the same white background.
- Browser console error logs were empty.
- Screenshot: `docs/status/a519-followup-qa-screenshots/desktop-home-v8-local-article-state-viewport.png`

Verification:

- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm exec eslint apps/web/src/app/_components/HomeArticleStateCard.tsx apps/web/src/app/_components/AuthenticatedHome.tsx apps/web/src/app/home-dashboard-loader.ts apps/web/src/app/user/article-recent-reading-db-loader.ts`
