# A504 - CCX Memory And Tools Source Learning And Selective Porting

Date: 2026-06-26

## 1. Scope

This round was authorized to read only `E:\code\ccx` as the external reference project. The goal was to verify the CCX memory/tools analysis against real source and selectively move applicable low-level ideas into Learning Agent Platform.

The user clarified that CCX is an inherited internal school studio project with usage rights, so applicable code can be ported and modified even though there is no root license file.

## 2. Result

A504 completed both source verification and a narrowly scoped tool-runtime hardening pass.

Implemented:

- Hardened `packages/ai-core/src/tools` as the public low-level tool boundary.
- Added disabled-by-default behavior.
- Added explicit permission evaluation and required permission checks.
- Added lightweight input schema validation before handlers run.
- Added safe execution-error redaction.
- Stripped client-provided user IDs by default.
- Added `@learning-agent-platform/ai-core/tools` and `@learning-agent-platform/ai-core/memory` subpath exports.
- Added focused A504 tests.

Not implemented:

- No memory persistence changes.
- No compression runtime.
- No streaming executor port.
- No real LLM calls or real agent loop.
- No `/ai` runtime integration.
- No Prisma changes.

## 3. Source Verification Summary

Verified from CCX source:

- `BaseTool` is not a class. The real abstraction is `Tool`, `ToolDef`, and `buildTool()` in `src/Tool.ts`.
- Tool pool assembly is handled by `src/tools.ts` through `getAllBaseTools()`, `getTools()`, `assembleToolPool()`, and deny-rule filtering.
- Tool execution is handled by `src/services/tools/toolExecution.ts`: schema validation, tool-specific validation, hooks/permission decision, tool call, and structured result mapping.
- `StreamingToolExecutor` exists in `src/services/tools/StreamingToolExecutor.ts`, but it is too coupled to CCX streaming state for A504.
- Compression exists through `src/services/compact/*`, including `CompactionResult`, boundary marker, summaries, attachments, auto thresholds, microcompact, session-memory compact, and failure handling.
- Long-term memory is file-based through `src/memdir/*`, with `MEMORY.md`, topic markdown files, `user | feedback | project | reference` types, manifest scanning, and relevant-memory selection.
- Background memory extraction exists through `src/services/extractMemories/extractMemories.ts`.

Important mismatch with this project:

- CCX default `buildTool()` permission fallback allows execution and relies on broader permission machinery. Learning Agent Platform needs stricter disabled-by-default behavior.
- CCX long-term memory writes are file/tool based. Learning Agent Platform should use structured stores, explicit permission, and audit logs instead.

## 4. Files Changed

- `packages/ai-core/src/tools/types.ts`
- `packages/ai-core/src/tools/utils.ts`
- `packages/ai-core/src/tools/errors.ts`
- `packages/ai-core/src/tools/runtime.ts`
- `packages/ai-core/src/tools/index.ts`
- `packages/ai-core/package.json`
- `tests/a504-tools-runtime.test.mjs`
- `docs/status/A504_CCX_MEMORY_TOOLS_PORTING_REPORT.md`
- `docs/rounds/codex/A504_codex.md`
- `docs/codex-context/CURRENT_HANDOFF.md`

## 5. Verification

Passed:

- `pnpm exec tsx --test tests/a504-tools-runtime.test.mjs` - 8 tests passed.
- `pnpm --filter @learning-agent-platform/ai-core typecheck` - passed.
- `pnpm --filter @learning-agent-platform/web typecheck` - passed.
- `pnpm --filter @learning-agent-platform/desktop typecheck` - skipped by package script because desktop has no TypeScript yet.
- `pnpm --filter @learning-agent-platform/db typecheck` - passed.
- `pnpm --filter @learning-agent-platform/book-engine typecheck` - passed.
- `pnpm --filter @learning-agent-platform/learning-engine typecheck` - passed.
- `pnpm --filter @learning-agent-platform/shared typecheck` - passed.

Route smoke:

- Started Next dev server on `http://127.0.0.1:3104`.
- `GET /ai` - 200.
- `GET /user` - 200.
- `GET /problems` - 200.
- The temporary dev server was stopped.

Known limitation:

- Root `pnpm typecheck` failed before TypeScript execution because the Windows bash environment did not expose `/dev/stderr` for `tee /dev/stderr` in `scripts/vm-typecheck.sh`. Package-level typechecks were used as the fallback verification.

## 6. Next Recommendation

Next minimum task:

- Unify `packages/ai-core/src/agent-runtime/tools` with the hardened public `packages/ai-core/src/tools` runtime.
- Add audit/event records around permission decisions.
- Keep memory persistence and compression as separate future tasks.
