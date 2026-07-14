# Personalized Analysis Concurrency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start problem profiling and code analysis concurrently so a slow but useful problem-rating result no longer delays the code-analysis request.

**Architecture:** Keep both existing workflows and prompts unchanged. Add a test-only injection point for the code-analysis executor, start the profile promise and code-analysis promise after validation, and independently degrade each result before aggregating the existing A492 report.

**Tech Stack:** TypeScript, Node test runner, `tsx`, pnpm workspace packages.

## Global Constraints

- Do not modify the problem-profile prompt.
- Do not widen provider, tool, file-write, or persistence permissions.
- Preserve existing user-visible report types and fallback semantics.
- Only stage files changed for this task; preserve unrelated dirty-worktree changes.

---

### Task 1: Add the concurrency regression test

**Files:**
- Create: `tests/b015-personalized-analysis-concurrency.test.ts`
- Read: `packages/ai-core/src/code-analysis/personalized-orchestrator.ts`

**Interfaces:**
- Consumes `runPersonalizedCodeAnalysis` and `AgentDeps`.
- Injects `profileProblem` and the optional code-analysis executor.

- [ ] **Step 1: Write the failing test**

Create a test with a profile promise delayed by about 80ms and an injected code-analysis promise delayed by about 5ms. Assert that code analysis starts before the profile promise resolves, and assert that the final report still contains the profile rating.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --import tsx --test tests/b015-personalized-analysis-concurrency.test.ts
```

Expected: FAIL because the current orchestrator awaits `profileProblem` before invoking code analysis.

### Task 2: Parallelize the independent workflow stages

**Files:**
- Modify: `packages/ai-core/src/code-analysis/personalized-orchestrator.ts:53-230`

**Interfaces:**
- Add an optional `runCodeAnalysis` dependency with the same input and result types as `runCodeAnalysisWorkflow`.
- Production behavior defaults to `runCodeAnalysisWorkflow`.

- [ ] **Step 1: Start both stages without changing prompts**

Start the existing profile operation and the code-analysis operation after the plan event. Each operation must catch its own errors and preserve the current fallback report/profile behavior. Await both operations before learner-profile aggregation.

- [ ] **Step 2: Run the regression test to verify it passes**

Run:

```powershell
node --import tsx --test tests/b015-personalized-analysis-concurrency.test.ts
```

Expected: PASS, including the ordering assertion and retained profile assertion.

### Task 3: Verify affected packages and deployment inputs

**Files:**
- No additional source files.

- [ ] **Step 1: Run targeted tests**

```powershell
node --import tsx --test tests/b015-personalized-analysis-concurrency.test.ts tests/b014-code-analysis-runtime.test.ts
```

- [ ] **Step 2: Run type checks**

```powershell
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/web typecheck
```

- [ ] **Step 3: Build the production web bundle**

```powershell
pnpm --filter @learning-agent-platform/db build
pnpm --filter @learning-agent-platform/web build
```

- [ ] **Step 4: Review the staged file list**

Stage only the design, plan, regression test, and orchestrator files. Confirm unrelated pre-existing modifications are not staged.

### Task 4: Commit, push, and sync production

**Files:**
- No additional source files.

- [ ] **Step 1: Commit only the scoped files**

```powershell
git add docs/superpowers/specs/2026-07-14-personalized-analysis-concurrency-design.md docs/superpowers/plans/2026-07-14-personalized-analysis-concurrency.md tests/b015-personalized-analysis-concurrency.test.ts packages/ai-core/src/code-analysis/personalized-orchestrator.ts
git commit -m "fix: parallelize personalized code analysis"
```

- [ ] **Step 2: Push the current branch**

```powershell
git push origin main
```

- [ ] **Step 3: Sync the server using the documented release flow**

On the production host, update the repository/release artifact, install with the lockfile, build, restart `learning-agent-platform`, and verify:

```bash
curl -fsS https://cfagent.fun/api/health
```

Expected: a JSON response with `status` and `database` both equal to `ok`.
