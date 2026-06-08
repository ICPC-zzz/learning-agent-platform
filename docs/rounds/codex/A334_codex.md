# A334 Codex Round

## What changed
- Reader dev-only sync trigger now forwards a safe progress payload through the async server action wrapper.
- The payload includes `bookId`, `chapterId`, `progressRatio`, optional `currentOffset`, optional `currentCfi`, optional `source`, and `explicitUserAuthorization=true` for dev/test opt-in only.
- The Reader page now derives a safe preview payload from current reader state when available, and falls back to a preview ratio without exposing any sensitive fields.
- The dev trigger click path now uses the current live snapshot payload when available, so the clicked request matches what the UI is showing.
- `progressRatio` is normalized into the safe `0-1` range before the trigger input is built.
- The preview UI now shows the pending sync summary, including `bookId`, `chapterId`, and `progressRatio`.

## Safety boundaries
- Default production remains hidden and disabled.
- No real auth provider was added.
- No public route was added.
- No schema or migration changes were made.
- No client-side Prisma import was introduced.
- No default production DB write path was enabled.
- The payload does not include `userId`, token, session, cookie, raw DB records, or secrets.

## Verification
- `npm run lint`
- `npm run typecheck`
- `node apps/web/src/app/reader/reader-sync-dev-trigger-preview.test.mjs`
- `node apps/web/src/app/reader/reader-sync-preview-panel.test.mjs`
- `node apps/web/src/app/reader/reader-sync-real-server-action.test.mjs`
- `node apps/web/src/app/reader/reader-sync-real-server-action-core.test.mjs`

## Browser check
- Default `/reader` does not show the dev trigger.
- With `LAP_READER_SYNC_DEV_TRIGGER=true`, `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll` shows the dev-only sync preview summary in the right rail.
- The browser-side dev preview now prefers current scroll / visible-block state when available, so the visible payload summary reflects the current page position instead of only server-side saved progress.
- Click behavior remains covered by the Reader sync tests and stays preview-only / blocked when guards are not satisfied.

## Files changed
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
- `apps/web/src/app/reader/ReaderSyncDevTriggerPreview.tsx`
- `apps/web/src/app/reader/reader-sync-real-server-action.server.ts`
- `apps/web/src/app/reader/reader-sync-real-server-action-core.ts`
- `apps/web/src/app/reader/reader-sync-dev-trigger-preview.test.mjs`
- `apps/web/src/app/reader/reader-sync-preview-panel.test.mjs`
- `apps/web/src/app/reader/reader-sync-real-server-action.test.mjs`
- `apps/web/src/app/reader/reader-sync-real-server-action-core.test.mjs`
- `docs/codex-context/CURRENT_HANDOFF.md`

## Next suggestion
- Keep the same safety boundary and, in the next round, decide whether the dev trigger should also surface a small explicit `blocked/preview/test-only` result badge after the click, while still staying blocked by default.
