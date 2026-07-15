# Codeforces Wrongbook Auth Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Codeforces wrongbook review Server Action recognize the same authenticated database session as the Codeforces refresh action.

**Architecture:** Keep identity resolution entirely server-side. Replace the legacy development-cookie path in `generateCfWrongBookReview` with `getCurrentAuthSession()`, while preserving existing result types and all Codeforces analysis behavior. A focused contract regression test prevents the action from returning to `lap-web-dev-session` or `userIdPreview`.

**Tech Stack:** TypeScript, Next.js 15 Server Actions, Node.js test runner, Prisma-backed Web sessions, pnpm.

## Global Constraints

- Do not modify Codeforces refresh, binding, synchronization, rating, or recommendation algorithms.
- Do not accept a client-provided user ID.
- Do not stage unrelated dirty-worktree changes.
- Build the exact committed revision locally; do not install dependencies or build on the production server.
- Preserve the persistent report data directory and use an atomic production release switch.

---

### Task 1: Unify Wrongbook Review Authentication

**Files:**
- Create: `tests/b019-cf-wrongbook-auth-session.test.mjs`
- Modify: `apps/web/src/app/user/cf-wrongbook-review-action.ts:11-36`

**Interfaces:**
- Consumes: `getCurrentAuthSession(): Promise<AuthSessionResult>` from `apps/web/src/lib/session/web-auth-session.ts`.
- Produces: unchanged `generateCfWrongBookReview(): Promise<CfWrongBookReviewActionOutput>` behavior with a trusted database `userId`.

- [ ] **Step 1: Write the failing regression test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewAction = readFileSync(
  new URL("../apps/web/src/app/user/cf-wrongbook-review-action.ts", import.meta.url),
  "utf8",
);
const refreshAction = readFileSync(
  new URL("../apps/web/src/app/user/codeforces-server-actions.ts", import.meta.url),
  "utf8",
);

test("错题复习计划与 Codeforces 刷新共用正式登录会话", () => {
  assert.match(reviewAction, /getCurrentAuthSession/);
  assert.match(refreshAction, /getCurrentAuthSession/);
  assert.doesNotMatch(reviewAction, /lap-web-dev-session/);
  assert.doesNotMatch(reviewAction, /deserializeDevSession/);
  assert.doesNotMatch(reviewAction, /userIdPreview/);
});
```

- [ ] **Step 2: Verify the test fails against the unmodified committed action**

Run in an isolated worktree created from `d8fa345`:

```powershell
node --test tests/b019-cf-wrongbook-auth-session.test.mjs
```

Expected: FAIL because `cf-wrongbook-review-action.ts` does not contain `getCurrentAuthSession` and still contains the legacy development-session identifiers.

- [ ] **Step 3: Apply the minimal Server Action change**

Replace the legacy imports:

```ts
import { cookies } from "next/headers";
import { deserializeDevSession, getSafeSessionSummary } from "../../lib/web-auth-dev-session";
```

with:

```ts
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";
```

Replace the legacy user resolution:

```ts
let userId: string | null = null;
try {
  const ck = await cookies();
  userId = getSafeSessionSummary(
    deserializeDevSession(ck.get("lap-web-dev-session")?.value),
  ).user?.userIdPreview ?? null;
} catch {}
```

with:

```ts
const session = await getCurrentAuthSession();
const userId = session.hasSession ? session.userId : null;
```

- [ ] **Step 4: Verify the regression test passes**

```powershell
node --test tests/b019-cf-wrongbook-auth-session.test.mjs
```

Expected: 1 test passed, 0 failed.

- [ ] **Step 5: Run focused Web verification**

```powershell
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web exec node --test ../../tests/b019-cf-wrongbook-auth-session.test.mjs
```

Expected: TypeScript exits with code 0; the authentication regression test passes.

### Task 2: Document, Commit, Push, and Deploy

**Files:**
- Create: `docs/rounds/codex/B19_codex.md`
- Modify: `docs/codex-context/CURRENT_HANDOFF.md` by appending only the B19 result without staging unrelated existing changes.

**Interfaces:**
- Consumes: the verified Task 1 implementation and commit hash.
- Produces: GitHub `main` and `/opt/learning-agent-platform/current` at the same exact commit.

- [ ] **Step 1: Record the root cause and verification**

`B19_codex.md` must state:

```markdown
- Codeforces refresh already used `getCurrentAuthSession()`.
- Wrongbook review incorrectly used `lap-web-dev-session` and `userIdPreview`.
- Refreshing Codeforces data did not clear the login; the two actions had different auth sources.
- The fix changes only the wrongbook Server Action and adds a regression contract.
```

- [ ] **Step 2: Run final tests and inspect the exact staged scope**

```powershell
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web exec node --test ../../tests/b019-cf-wrongbook-auth-session.test.mjs
git diff --check -- apps/web/src/app/user/cf-wrongbook-review-action.ts tests/b019-cf-wrongbook-auth-session.test.mjs docs/rounds/codex/B19_codex.md
git diff --cached --name-only
```

Expected: all commands exit 0 and the staged list contains only the approved implementation, regression test, B19 summary, and the B19-only handoff hunk.

- [ ] **Step 3: Commit and push `main`**

```powershell
git commit -m "fix: unify wrongbook review authentication"
git -c http.proxy=socks5h://127.0.0.1:1080 push origin main
```

Expected: the new commit is present on `origin/main`.

- [ ] **Step 4: Build the exact commit locally**

Use the existing isolated build worktree, switch it to the new commit, safely remove only its `apps/web/.next`, then run:

```powershell
node E:\code\learning-agent-platform\node_modules\next\dist\bin\next build --no-lint
```

Expected: Next.js production build exits 0 and writes a new `BUILD_ID`.

- [ ] **Step 5: Prepare and atomically deploy a new server release**

Clone the exact commit into a new `/opt/learning-agent-platform/releases/<timestamp>-<short-hash>` directory, reuse the current release's dependency directories and persistent `apps/web/.data`, upload the locally built `.next`, verify the release commit and `BUILD_ID`, then atomically replace `/opt/learning-agent-platform/current` and restart `learning-agent-platform.service` with rollback on health failure.

Expected: no `pnpm install` or `next build` runs on the server; `/api/health` returns HTTP 200 with database status `ok`.

- [ ] **Step 6: Verify production identity behavior and resource usage**

Use an existing authenticated browser session to click “生成错题复习计划” after a Codeforces refresh. Confirm it no longer returns `NOT_LOGGED_IN`; then verify:

```bash
git -C /opt/learning-agent-platform/current rev-parse HEAD
systemctl is-active learning-agent-platform.service
ps -eo pid,pcpu,pmem,comm,args --sort=-pcpu | head -8
```

Expected: server HEAD equals GitHub `main`, service is active, and no build or dependency-install process remains running.
