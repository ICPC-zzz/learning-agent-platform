# A333 Codex Round

## Goal
Connect the Reader dev trigger click to the async server action wrapper, and let the disabled-by-default path reach a test-only real DB execution flow when explicit dev/test opt-ins are present.

## What Changed
- Wired the Reader dev trigger preview so the click helper forwards `bookId` and `chapterId` into the server action callback.
- Reworked `previewReaderSyncRealServerAction` so the dev/test DB path is still blocked by default, but can reach the test-only real DB flow when all required opt-in flags are enabled.
- Updated the Reader progress sync service to accept the trusted real `serverUserId` from the core and pass it to the persistent adapter.
- Kept the default production path closed.
- Avoided schema, migration, public route, Desktop, and Skill changes.

## Verification
- `node apps/web/src/app/reader/reader-sync-real-server-action-dev-db.test.mjs`
- `node apps/web/src/app/reader/reader-sync-real-server-action.test.mjs`
- `node apps/web/src/app/reader/reader-sync-dev-trigger-preview.test.mjs`
- `node apps/web/src/app/reader/reader-sync-preview-panel.test.mjs`
- `npm run typecheck`
- `npm run lint`

## Result
- The local/test DB execution path was reached successfully.
- The `ReadingProgress` row was upserted in the local/test database.

## Notes
- The default path remains disabled-by-default.
- The server wrapper does not read or expose secrets.
- The dev-only real DB path only runs when the explicit opt-in flags are enabled.
