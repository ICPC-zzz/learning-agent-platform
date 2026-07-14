# B15: Personalized code analysis concurrency fix

## Scope

- Keep the existing problem-profile prompt and Rating behavior unchanged.
- Prevent a slow problem-profile model call from delaying the start of code analysis.

## Root cause

`runPersonalizedCodeAnalysis` awaited `profileProblem` before invoking `runCodeAnalysisWorkflow`. The two model calls were independent, so their latencies accumulated inside one server request.

## Changes

- Start problem profiling and code analysis concurrently after input validation.
- Keep independent error degradation: a profile failure uses the existing rule profile, and a code-analysis failure keeps the other personalized data.
- Add an optional injected code-analysis executor for deterministic orchestration testing; production defaults to the existing workflow.
- Do not change the problem-profile prompt, provider permissions, persistence boundary, or report shape.

## Verification

- `pnpm --filter @learning-agent-platform/web exec node --import tsx --test ../../tests/b015-personalized-analysis-concurrency.test.ts ../../tests/b014-code-analysis-runtime.test.ts`: 3 passed.
- `pnpm --filter @learning-agent-platform/web exec node --test ../../tests/a492-personalized-analysis.test.mjs ../../tests/a491-code-analysis.test.mjs`: 136 passed.
- `pnpm --filter @learning-agent-platform/ai-core typecheck`: passed.
- `pnpm --filter @learning-agent-platform/web typecheck`: passed.
- `pnpm --filter @learning-agent-platform/web build`: passed.
- Full ai-core/web lint remains blocked by pre-existing workspace lint debt (186 / 693 errors respectively); no lint cleanup was included in this scope.

## Git and deployment

- Scoped files must be staged without including the existing unrelated dirty-worktree changes.
- Push the scoped commit to `origin/main`.
- Production synchronization requires the existing server release access; verify `https://cfagent.fun/api/health` after deployment.
