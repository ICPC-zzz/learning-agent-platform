# A516 Context and Tool Result Compression Closure

Date: 2026-06-28

## Scope

A516 completed the R6 context and tool-result handling on the existing A515 Reliable Agent Loop path. It did not create a second Agent Loop, Tool Runtime, or Context Manager.

Primary implementation files:

- `packages/ai-core/src/agent-runtime/tool-result-context.ts`
- `packages/ai-core/src/agent-runtime/reliable-agent-loop.ts`
- `apps/web/src/lib/assistant/assistant-task-repository.ts`
- `apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts`
- `apps/web/src/app/_components/AssistantChatPanel.tsx`

## Implemented Chain

Tool result feedback before the next provider request:

1. Receive canonical `ToolExecutionResult`.
2. Sanitize sensitive keys and sensitive string patterns.
3. Estimate single-result, per-round, and per-loop budgets.
4. Inject small safe results directly.
5. Convert large safe results to model-visible preview plus artifact reference.
6. Persist large safe artifacts through `FileAssistantTaskRepository` with owner/run isolation.
7. Feed the model only safe summary, preview, source references, and artifact metadata.

Provider request preparation:

1. Estimate context budget using A505 context-budget primitives.
2. Microcompact older consumed tool results.
3. Preserve the latest tool call/result pair and pending tool results.
4. Preserve terminal cancel, timeout, permission, and failure states from compaction.
5. Generate deterministic structured summaries when no summary model is available.
6. Open a compression circuit after repeated failures and block safely at the blocking threshold.

## Artifact Safety

Artifacts record safe metadata:

- `artifactId`
- `ownerUserId`
- `conversationId`
- `runId`
- `toolCallId`
- `toolName`
- `safePreview`
- `sourceRefs`
- `size`
- `createdAt`
- `expiresAt`

The task view exposes only metadata. Artifact file paths are internal to the repository and were not exposed in the view. Cross-user reads return `null`.

Sensitive results are not persisted. If sensitive fields are detected, the model receives a redacted safe summary and the result is marked as `sensitiveResultNotPersisted`.

## Compression State

The R6 context state includes:

- Tool-result budget counters.
- Preserved recent tool results.
- Microcompacted older tool messages.
- Deterministic structured conversation summary.
- Compression circuit state: failure count, last failure time, and open-until timestamp.

When the circuit is open at blocking threshold, the loop returns a Chinese blocking answer and does not call the provider again.

## Validation

Passed:

```powershell
node --test tests/a515-*.test.mjs
node --test tests/a516-*.test.mjs
node --test tests/a512-*.test.mjs
node --test tests/a513-*.test.mjs
node --test tests/a514-*.test.mjs
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm run typecheck
npx eslint packages/ai-core/src/agent-runtime/reliable-agent-loop.ts packages/ai-core/src/agent-runtime/tool-result-context.ts apps/web/src/lib/assistant/assistant-task-repository.ts apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts apps/web/src/app/_components/AssistantChatPanel.tsx tests/a515-reliable-agent-loop.test.mjs tests/a515-assistant-task-repository-agent-loop-events.test.mjs tests/a516-assistant-task-artifact-repository.test.mjs tests/a516-reliable-agent-loop-context.test.mjs tests/a516-tool-result-context.test.mjs tests/a516-web-development-agent-loop-provider.test.mjs
```

Notes:

- A514 real Prisma test skipped safely because `LAP_ALLOW_REAL_DB_TESTS=1` was not set.
- Root typecheck passed with the VM TypeScript helper and copied dependencies because Windows symlink privileges were unavailable.
- Full repository lint was not run; scoped lint for touched A516 files passed.

## Remaining Risk

- Real external provider behavior still requires a separate user-configured model QA pass.
- Reliable Loop browser permission-denied injection should be tightened in a later narrow task if permission-denied needs explicit browser-path coverage beyond A512/A513 canonical runtime tests.
