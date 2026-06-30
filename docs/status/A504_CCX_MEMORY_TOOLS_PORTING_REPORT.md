# A504 CCX Memory And Tools Porting Report

Date: 2026-06-26

## 1. Conclusion

This round verified the CCX memory, tool, runtime, and compaction source against the previous analysis, then selectively adapted the safe low-level tool-runtime concepts into `packages/ai-core/src/tools`.

The user clarified that `E:\code\ccx` is an inherited internal school studio project with usage rights, despite having no GitHub repository or root license file. Based on that authorization, this round was no longer blocked by the missing `LICENSE`/`NOTICE` files.

No CCX file was copied wholesale. The implementation adapted the useful runtime ordering and safety ideas into the existing Learning Agent Platform tool boundary:

- tool definition normalization;
- disabled-by-default behavior;
- explicit permission evaluation;
- lightweight JSON-schema-like input validation;
- safe error redaction;
- client-provided `userId` stripping by default;
- focused runtime tests.

Memory persistence, compression runtime, streaming tool execution, real LLM calls, and `/ai` integration were intentionally not implemented in A504.

## 2. Authorization And Source Check

Checked:

- `E:\code\ccx\LICENSE` - missing.
- `E:\code\ccx\NOTICE` - missing.
- `E:\code\ccx\package.json` - missing.

User authorization:

- The user stated that `E:\code\ccx` is an internal inherited project used by the school studio.
- The user stated the project has usage rights and applicable code may be directly ported and modified.

Engineering decision:

- Use the authorization to proceed with selective porting.
- Keep the implementation scoped to concepts that fit the current architecture.
- Avoid copying CCX-coupled source because CCX depends on its own message model, Anthropic blocks, hooks, permission UI, and file-based memory behavior.

## 3. Current Project Context

Relevant current files read:

- `packages/ai-core/package.json`
- `packages/ai-core/src/index.ts`
- `packages/ai-core/src/tools/types.ts`
- `packages/ai-core/src/tools/registry.ts`
- `packages/ai-core/src/tools/runtime.ts`
- `packages/ai-core/src/tools/errors.ts`
- `packages/ai-core/src/tools/utils.ts`
- `packages/ai-core/src/tools/index.ts`
- `packages/ai-core/src/agent-runtime/tools/tool-types.ts`
- `packages/ai-core/src/agent-runtime/tools/tool-registry.ts`
- `packages/ai-core/src/agent-runtime/tools/tool-executor.ts`
- `packages/ai-core/src/agent-runtime/tools/tool-permission.ts`
- `packages/ai-core/src/agent-runtime/tool-system.test.mjs`
- `packages/ai-core/src/memory/*`

Current project already has overlapping tool and memory scaffolds. A504 therefore hardened the existing public low-level `packages/ai-core/src/tools` boundary instead of adding a second runtime stack.

## 4. CCX Files Read

Targeted CCX files read or symbol-checked:

- `E:\code\ccx\src\Tool.ts`
- `E:\code\ccx\src\tools.ts`
- `E:\code\ccx\src\query.ts`
- `E:\code\ccx\src\query\tokenBudget.ts`
- `E:\code\ccx\src\context.ts`
- `E:\code\ccx\src\services\tools\toolExecution.ts`
- `E:\code\ccx\src\services\tools\toolOrchestration.ts`
- `E:\code\ccx\src\services\tools\toolHooks.ts`
- `E:\code\ccx\src\services\tools\StreamingToolExecutor.ts`
- `E:\code\ccx\src\services\compact\compact.ts`
- `E:\code\ccx\src\services\compact\autoCompact.ts`
- `E:\code\ccx\src\services\compact\microCompact.ts`
- `E:\code\ccx\src\services\compact\sessionMemoryCompact.ts`
- `E:\code\ccx\src\services\SessionMemory\sessionMemory.ts`
- `E:\code\ccx\src\services\extractMemories\extractMemories.ts`
- `E:\code\ccx\src\memdir\memdir.ts`
- `E:\code\ccx\src\memdir\memoryTypes.ts`
- `E:\code\ccx\src\memdir\memoryScan.ts`
- `E:\code\ccx\src\memdir\findRelevantMemories.ts`
- `E:\code\ccx\src\utils\attachments.ts`

No other external reference project was read.

## 5. Source Verification Table

| Capability | CCX actual file | Core type/function | A504 handling |
| --- | --- | --- | --- |
| Tool contract | `src/Tool.ts` | `Tool`, `ToolDef`, `buildTool` | Adapted concepts into existing `ToolDefinition`; no direct CCX type copy |
| Tool pool | `src/tools.ts` | `getAllBaseTools`, `getTools`, `assembleToolPool` | Not ported; current `InMemoryToolRegistry` kept |
| Tool execution | `src/services/tools/toolExecution.ts` | validation, hooks, permission, call, result mapping | Execution order adapted into `InMemoryToolRuntime` |
| Streaming execution | `src/services/tools/StreamingToolExecutor.ts` | streamed tool-use execution | Not ported; too coupled to CCX message streaming |
| Permission check | `src/Tool.ts`, `src/services/tools/toolExecution.ts` | `checkPermissions`, deny filtering | Replaced with project-local deny/confirm evaluator |
| Input validation | `src/Tool.ts`, `src/services/tools/toolExecution.ts` | Zod `safeParse`, tool validators | Adapted as lightweight JSON-schema-like validation |
| Structured result | `src/Tool.ts`, `src/services/tools/toolExecution.ts` | `ToolResult`, `tool_result` mapping | Kept current `ToolCallResult` shape |
| Context budget | `src/query/tokenBudget.ts`, `src/services/compact/autoCompact.ts` | warning/error/blocking thresholds | Analysis only; not implemented |
| Compression | `src/services/compact/*` | `CompactionResult`, compact rebuild | Analysis only; not implemented |
| Memory taxonomy | `src/memdir/memoryTypes.ts` | `user`, `feedback`, `project`, `reference` | Analysis only; not implemented |
| Memory retrieval | `src/memdir/findRelevantMemories.ts` | side-query relevant selection | Analysis only; not implemented |
| Memory extraction | `src/services/extractMemories/extractMemories.ts` | background forked extraction | Not ported; not suitable for current safety boundary |

## 6. Source Verification Findings

- CCX does not have a `BaseTool` class. The actual abstraction is a `Tool` type plus `buildTool()` defaults.
- Tool pool assembly is in `src/tools.ts`, not a standalone `ToolRegistry` class.
- Tool execution validates input schema, then tool-specific validation, then hooks/permission, then calls the tool and maps a structured result.
- Unknown and rejected tools are converted into error tool results.
- `StreamingToolExecutor` exists, but it is coupled to CCX streaming and message-block state.
- Compact flow exists with `CompactionResult`, boundary marker, summary messages, attachments, hook results, token counts, post-compact message rebuild, and failure handling.
- Auto compact reserves output budget and uses warning/error/blocking states plus a consecutive-failure circuit breaker.
- Session memory compact preserves `tool_use` / `tool_result` invariants.
- Long-term memory is file-based through `MEMORY.md`, topic markdown files, frontmatter, conservative relevant-memory selection, and background extraction.

Important project caveats:

- CCX default `buildTool()` permission fallback allows execution and relies on broader permission machinery. Learning Agent Platform needs stricter disabled-by-default and permission gates.
- CCX file-based memory writes should not be migrated into this project. Future memory writes should go through structured stores, explicit consent, and audit logs.

## 7. Implemented In A504

Changed:

- `packages/ai-core/src/tools/types.ts`
- `packages/ai-core/src/tools/utils.ts`
- `packages/ai-core/src/tools/errors.ts`
- `packages/ai-core/src/tools/runtime.ts`
- `packages/ai-core/src/tools/index.ts`
- `packages/ai-core/package.json`
- `tests/a504-tools-runtime.test.mjs`
- `docs/rounds/codex/A504_codex.md`
- `docs/status/A504_CCX_MEMORY_TOOLS_PORTING_REPORT.md`
- `docs/codex-context/CURRENT_HANDOFF.md`

Tool runtime changes:

- Added `disabledByDefault`, `readOnly`, `sideEffect`, `allowClientUserId`, and `requiredPermissions` fields to `ToolDefinition`.
- Added `trustedUserId`, `enabledTools`, and `grantedPermissions` to `ToolCallContext`.
- Added error codes for disabled tools, permission denial, and invalid input.
- Added `ToolPermissionEvaluator` and a default evaluator.
- Default tools are disabled unless listed in `context.enabledTools`.
- Required permissions are checked against `context.grantedPermissions`.
- Confirmation-required tools still return `requires_confirmation` unless confirmed.
- Input is validated before handler execution.
- Client-controlled top-level `userId` and `context.userId` are stripped unless the tool explicitly allows client user IDs.
- Sensitive handler errors are redacted before returning to callers.
- Added `@learning-agent-platform/ai-core/tools` and `@learning-agent-platform/ai-core/memory` package subpath exports.

## 8. Not Implemented

- No CCX `StreamingToolExecutor` port.
- No memory store schema changes.
- No file-based memory writes.
- No automatic memory extraction.
- No compression runtime.
- No user-triggered compression command.
- No learning report, review plan, Codeforces, or code-analysis tool adapters.
- No real LLM calls.
- No real agent loop.
- No `/ai` runtime integration.
- No Prisma schema or migration changes.
- No Git add/commit/push.

## 9. Existing Project Duplication

Current project still has overlapping layers:

- `packages/ai-core/src/tools/*`: public generic registry/runtime.
- `packages/ai-core/src/agent-runtime/tools/*`: richer agent-tool skeleton.
- `packages/ai-core/src/memory/*`: memory store/retriever/extractor/compressor scaffold.
- `packages/ai-core/src/agent/*`: preview-only web-agent scaffolds.

Recommended direction remains:

- Keep `packages/ai-core/src/tools/*` as the public low-level tool contract.
- Make `agent-runtime/tools` either the canonical executor or an adapter over the public runtime in a later task.
- Avoid enabling memory persistence or real tool execution until audit logs and user controls exist.

## 10. Future Memory Model Recommendation

Suggested clean-room vocabulary for later tasks:

```ts
type MemoryTier = "long_term" | "working" | "short_term";

type MemorySource =
  | "conversation"
  | "user_explicit"
  | "learning_report"
  | "review_plan"
  | "codeforces_profile"
  | "code_analysis";

type CompressionReason =
  | "context_budget"
  | "user_requested"
  | "conversation_boundary";
```

Recommended write statuses:

- `confirmed`: user explicitly asked to save.
- `suggested`: system proposes saving but waits for approval.
- `ephemeral`: short-term conversation state.
- `readonly_context`: sourced from learning reports, review plans, Codeforces, or code analysis records.

Long-term memory must not silently persist model guesses.

## 11. Tests And Verification

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
- The dev server process started for this check was stopped.

Known verification limitation:

- Root `pnpm typecheck` failed before TypeScript execution in the Windows bash environment because `scripts/vm-typecheck.sh` writes through `tee /dev/stderr`, and `/dev/stderr` was unavailable. Package-level typechecks were run instead.

## 12. Next Minimum Task

Recommended next task:

- Unify `packages/ai-core/src/agent-runtime/tools` with the hardened public `packages/ai-core/src/tools` runtime.
- Keep this as a separate task from memory persistence and compression.
- Add audit/event records around tool permission decisions before any real tool execution is connected to UI or an agent loop.
