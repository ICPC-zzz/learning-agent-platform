# A504+ - CCX Memory And Tools Verification Plus Clean-room Contracts

Date: 2026-06-27

## Scope

This was an A504 remediation round, not A505.

Allowed external reference project:

- `E:\code\ccx`

Forbidden external projects were not read:

- `E:\code\harness-main`
- `E:\code\claude-desktop-app-main`

## A504 已完成

- Hardened `packages/ai-core/src/tools` with disabled-by-default behavior.
- Added tool permission evaluation.
- Added tool input validation.
- Added safe tool error redaction.
- Stripped client-provided `userId` by default.
- Added `@learning-agent-platform/ai-core/tools` subpath export.
- Preserved `tests/a504-tools-runtime.test.mjs`.

## A504 原任务遗漏

- `CCX_MEMORY_AND_TOOLS_ANALYSIS.md` was based on prior analysis docs and explicitly said no CCX source was read.
- A504 did not provide enough durable evidence for actual CCX file/symbol/call-chain verification.
- A504 did not establish the minimal three-tier memory, context budget, or compression request contracts.
- A504 license handling relied on user authorization, while A504+ re-applied the stricter repository license gate.

## A504+ 已补齐

- Checked `E:\code\ccx\LICENSE`, `NOTICE`, and `package.json`; all are missing.
- Applied the license gate: no CCX source COPY or ADAPT.
- Target-read CCX source for tools, permissions, memory, context budget, and compaction.
- Created `docs/status/A504_PLUS_CCX_VERIFICATION.md`.
- Added clean-room memory/runtime contracts in `packages/ai-core/src/memory/contracts.ts`.
- Exported the contracts through `packages/ai-core/src/memory/index.ts`.
- Added `tests/a504-plus-memory-contracts.test.mjs`.
- Made local `tools` and `memory` TS imports explicit with `.ts` extensions so the required bare `node --test` commands can resolve them.

## 仅完成分析

For CCX implementation details, this round only performed source verification and architectural analysis:

- Tool execution order.
- Permission and hook checks.
- Streaming tool executor existence.
- File-based memory taxonomy and manifest scanning.
- Relevant memory side-query selection.
- Auto compact thresholds and failure circuit breaker.
- Compact result and post-compact message ordering.

## 实际搬运

No CCX code was copied.

Actual project code added:

- `MemoryTier`
- `MemorySource`
- `MemoryRecordStatus`
- `MemoryRecord`
- `MemoryCandidate`
- `MemoryStore`
- `MemoryClassifier`
- `ContextBudget`
- `ContextBudgetResult`
- `CompressionReason`
- `CompressionRequest`
- `CompressionResult`
- `ContextCompressor`
- `evaluateContextBudget()`
- `createCompressionRequest()`
- `createPreviewCompressionResult()`
- `authorizeMemoryWrite()`

## 适配重写

Everything added in `contracts.ts` is clean-room REWRITE based on project requirements and verified CCX design ideas.

Key safety behavior:

- Long-term memory requires both permission and explicit user confirmation.
- Read-only business context is not writable memory.
- Context budget evaluation only returns a decision; it does not call a model.
- Compression result is preview-only and sets `modelInvoked: false`.

## 未实现

- No automatic compression flow.
- No real LLM summary.
- No memory DB schema.
- No Prisma migration.
- No `/ai` wiring.
- No learning report, review plan, Codeforces, or code-analysis Tool.
- No real provider call.
- No real Agent loop.
- No Git add, commit, or push.

## 验证

Passed:

- `pnpm --filter @learning-agent-platform/ai-core typecheck`
- `node --test tests\a504-tools-runtime.test.mjs`
- `node --test tests\a504-plus-*.test.mjs`
- `node --input-type=module -e "const m = await import('@learning-agent-platform/ai-core/memory'); console.log(typeof m.MemoryTier, m.MemoryTier.LongTerm, typeof m.evaluateContextBudget);"` from `packages/ai-core`
- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm --filter @learning-agent-platform/desktop typecheck` - skipped by package script because desktop has no TypeScript yet
- `pnpm --filter @learning-agent-platform/db typecheck`
- `pnpm --filter @learning-agent-platform/book-engine typecheck`
- `pnpm --filter @learning-agent-platform/learning-engine typecheck`
- `pnpm --filter @learning-agent-platform/shared typecheck`

Root typecheck:

- `pnpm run typecheck` failed before TypeScript execution because Windows bash still cannot resolve `/dev/stderr` for `tee`.

Web regression:

- Started temporary dev server at `http://127.0.0.1:3105`.
- `/ai` returned 200.
- `/user` returned 200.
- `/problems` returned 200.
- Temporary server was stopped.

## 未验证

- Full browser hydration logs were not captured.
- Root `pnpm run typecheck` remains blocked by the unrelated `/dev/stderr` script/environment issue.
- CCX license permissions remain unproven from repository files, so future source copying remains blocked unless a real license or explicit legal source is added.

## Next Recommendation

Next minimum task:

- Unify `packages/ai-core/src/agent-runtime/tools` as an adapter over `packages/ai-core/src/tools`, or explicitly mark it as legacy skeleton.
- Add structured audit events around permission decisions before any real tool execution is connected.
- Keep memory persistence and actual compression execution as separate future tasks.
