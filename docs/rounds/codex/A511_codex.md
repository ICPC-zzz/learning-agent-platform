# A511 Codex Summary - Agent R1 Implementation

## Scope

Implemented only the first business loop from the A511 Agent plan:

- Long-term memory can be written, reloaded, and deleted from the real `/ai` browser UI.
- Explicit chat memory intent (`请记住...`) writes to the user-managed long-term memory list.
- Floating assistant entry was removed from the app shell and current user-facing runtime surfaces.

No Tool Runtime unification, Agent Loop rewrite, background memory consolidation, execution timeline, Prisma schema change, migration, git staging, or commit was performed.

## Memory FK Fix

- `PrismaMemoryRepository.addMemory()` now checks whether `sessionId` and `sourceMessageId` refer to real Prisma `AgentSession` / `AgentMessage` rows before writing those FK columns.
- File-based assistant conversation/message ids are not written into FK columns; they are preserved in metadata:
  - `sourceConversationId`
  - `externalSessionId`
  - `sessionReferenceKind`
  - `sourceMessageId`
  - `externalSourceMessageId`
  - `sourceMessageReferenceKind`
- Web assistant memory code maps the browser dev-session preview id through `PrismaUserRepository.findOrCreateUser()` and writes memory rows with the real database `User.id`.
- Legacy preview-owner records remain readable through owner alias lookup.

## Floating Assistant Removal

- Removed root layout mount and source file for `FloatingAiAssistant`.
- Removed current runtime/user-facing references to the floating entry from:
  - `/ask`
  - authenticated home helper text
  - admin AI status page
  - admin status category grouping
  - assistant route keyword allowlist
  - safe user data summary comment
- `/ai` remains the only assistant entry point.

## Tests

Passed:

- `npm run typecheck`
- `npm run lint`
- `node --test tests/a511-memory-fk.test.mjs tests/a511-floating-assistant-removal.test.mjs`
- `node --test apps/web/src/app/a462-main-nav.test.mjs apps/web/src/app/a472-books-ui-truthfulness.test.mjs`

Known unrelated failures when running broader historical app tests:

- `apps/web/src/app/a450-shell-isolation.test.mjs`
- `apps/web/src/app/a451-admin-status-center.test.mjs`
- `apps/web/src/app/a470-frontend-stabilization.test.mjs`
- `apps/web/src/app/a471-email-auth.test.mjs`
- `apps/web/src/app/a476-assistant-core.test.mjs`

These failures reference older navigation/design/status expectations and were not caused by the A511 R1 memory/FK changes.

## Browser Verification

Started local Web:

- `http://127.0.0.1:3000`

Verified in browser:

- `/ai` loads and contains assistant page content without `悬浮球`, `Floating AI`, `FloatingAiAssistant`, or `浮窗`.
- `/ask` points users to `/ai` and does not advertise a floating assistant.
- `/admin/ai` no longer shows Floating AI status.
- Manual memory add appears in the memory list, survives reload after opening the memory tab, and can be deleted.
- Chat input `请记住：...` writes a `RETRIEVABLE` long-term memory with the file conversation reference visible as metadata-derived source, then deletion removes it from the list.
- No browser-visible Prisma/FK/raw provider error appeared in these checks.

## Database

- No Prisma schema change.
- No migration generated.
- No migration executed.
- No `prisma db push`, `migrate reset`, or destructive DB operation.

Current decision remains A511 plan option C:

- Keep memory ownership on real database `User.id`.
- Keep file-based conversation/message references outside FK columns unless the matching Prisma rows exist.
- Preserve external references in metadata for current Web assistant compatibility.

## Next Round

Next unique business task should be R2:

`统一 Tool 执行入口与失败回灌闭环`

Use `packages/ai-core/src/tools` as the canonical runtime, adapt Web assistant tools and `agent-runtime/tools`, and do not delete old runtimes in one step.
