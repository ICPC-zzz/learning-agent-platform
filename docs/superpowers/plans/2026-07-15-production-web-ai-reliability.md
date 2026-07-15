# Production Web AI Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production AI conversations use the explicitly authorized real model, keep diagnostics safe and Chinese, recover stale Server Actions, stop creating empty conversations on page entry, and keep protected-route redirects on the public production origin.

**Architecture:** A single Web AI guard evaluates either fail-closed development or double-opt-in production access from the canonical provider snapshot. The chat client shares the existing deployment-mismatch recovery helper and starts without a client-generated conversation ID so the repository can restore the latest active conversation. Admin status reads the same environment snapshot as runtime calls.

**Tech Stack:** TypeScript, React 19, Next.js 15 Server Actions, Node test runner, existing assistant provider and file conversation repositories.

## Global Constraints

- Production LLM calls require both `LAP_ALLOW_PRODUCTION_WEB_AI=true` and `LAP_ALLOW_REAL_LLM=true`.
- `LAP_LLM_ENABLED=false` blocks every runtime Provider path, including user-configured models, legacy multi-agent aggregation, and memory consolidation.
- Development LLM calls remain disabled by default and require the existing development opt-ins.
- Do not expose secrets, raw prompts, raw responses, internal guard text, or environment values to the ordinary user UI.
- Do not change prompts, recommendation algorithms, database schema, or existing conversation data.
- Preserve unrelated dirty-worktree changes and stage only B21 files.
- Build locally; do not install dependencies or build on the production server.

---

### Task 1: Add failing production guard contracts

**Files:**
- Modify: `apps/web/src/lib/web-ai-qa-guard.test.mjs`
- Create: `tests/b021-production-web-ai-reliability.test.mjs`

**Interfaces:**
- Consumes: `evaluateWebAiQaGuard(env)` and source files for the AI chat, store, and admin status.
- Produces: failing contracts for `external_production`, safe Chinese errors, deployment recovery wiring, empty-conversation prevention, and canonical status config.

- [ ] **Step 1: Extend the guard behavior test**

Add cases asserting that complete production configuration is blocked when either production opt-in is absent, allowed only when both are true, returns `external_production`, and exposes a Chinese notice without `NODE_ENV` or `dev guard`.

- [ ] **Step 2: Add the B21 source and repository contract**

Create a Node test that asserts:

```js
assert.match(chatSource, /getServerActionRecoveryMessage/);
assert.match(storeSource, /conversationId:\s*""/);
assert.doesNotMatch(storeSource, /conversationId:\s*createConversationId\(\)/);
assert.match(adminSource, /createAssistantProviderEnvSnapshot/);
```

Also instantiate `FileAssistantConversationRepository`, create an active conversation, call `getOrCreateConversation` without an ID, and assert that the same ID is returned and only one conversation exists.

- [ ] **Step 3: Run RED tests**

Run:

```bash
node apps/web/src/lib/web-ai-qa-guard.test.mjs
node --test tests/b021-production-web-ai-reliability.test.mjs
```

Expected: production guard and source contracts fail against the current implementation.

### Task 2: Implement the production-safe Web AI guard

**Files:**
- Modify: `apps/web/src/lib/web-ai-qa-guard.ts`
- Modify: `apps/web/src/lib/assistant/config/assistant-provider-config.ts`
- Modify: `apps/web/src/lib/admin-status-center.ts`
- Test: `apps/web/src/lib/web-ai-qa-guard.test.mjs`
- Test: `tests/b021-production-web-ai-reliability.test.mjs`

**Interfaces:**
- Consumes: `AssistantProviderEnv` and `loadAssistantProviderConfig`.
- Produces: `WebAiQaGuardResult` with mode `blocked | external_dev | external_production`, dynamic `devOnly`/`productionReady`, safe notice, reasons, and missing key names.

- [ ] **Step 1: Add production opt-ins to the environment snapshot**

Include `LAP_ALLOW_PRODUCTION_WEB_AI` in `createAssistantProviderEnvSnapshot`; retain `LAP_ALLOW_REAL_LLM`.

- [ ] **Step 2: Implement fail-closed mode selection**

Development requires the existing development feature switch. Production requires both production opt-ins. Shared assistant, provider, endpoint, auth, and model checks remain mandatory.

- [ ] **Step 3: Return safe public metadata**

Return `external_production`, `devOnly: false`, and `productionReady: true` for an allowed production configuration. Return a Chinese generic notice for blocked production without embedding key names or internal guard text.

- [ ] **Step 4: Make admin status use the canonical snapshot**

Replace the manually assembled partial environment object with `createAssistantProviderEnvSnapshot()` before calling `evaluateWebAiQaGuard`.

- [ ] **Step 5: Run focused tests GREEN**

Run the two Task 1 commands. Expected: all assertions pass.

### Task 3: Add ordinary-chat deployment recovery

**Files:**
- Modify: `apps/web/src/app/ai/server-action-recovery.ts`
- Modify: `apps/web/src/app/_components/AssistantChatPanel.tsx`
- Modify: `tests/b017-server-action-deployment-recovery.test.ts`
- Test: `tests/b021-production-web-ai-reliability.test.mjs`

**Interfaces:**
- Consumes: `getServerActionRecoveryMessage(error)`.
- Produces: a shared client helper path that recognizes deployment mismatch, shows a generic Chinese AI-operation message, and reloads once.

- [ ] **Step 1: Update B17 expected copy and add ordinary-chat source assertions**

The recovery message must say the system was updated and the user should retry the current AI operation, not specifically code analysis.

- [ ] **Step 2: Add a focused recovery handler in `AssistantChatPanel`**

Import the helper and route caught Server Action errors through one local function. On a match, set the safe message and schedule `window.location.reload()`; otherwise retain the existing operation-specific Chinese fallback.

- [ ] **Step 3: Cover initial load and user actions**

Use the handler for initial conversation loading, send, switch, compress, create, archive, and delete catches. Best-effort task polling can remain silent.

- [ ] **Step 4: Run B17 and B21 GREEN**

Run:

```bash
node --import tsx --test tests/b017-server-action-deployment-recovery.test.ts
node --test tests/b021-production-web-ai-reliability.test.mjs
```

Expected: all tests pass.

### Task 4: Stop implicit empty conversation creation

**Files:**
- Modify: `apps/web/src/app/_components/AssistantConversationStore.tsx`
- Modify: `apps/web/src/app/_components/AssistantChatPanel.tsx`
- Test: `tests/a505-conversation-repository.test.mjs`
- Test: `tests/b021-production-web-ai-reliability.test.mjs`

**Interfaces:**
- Consumes: empty string as “no requested conversation” and repository fallback to the most recent active record.
- Produces: page mount restores one existing active conversation; explicit new action still creates a new record.

- [ ] **Step 1: Add repository regression coverage**

Create one active conversation, call `getOrCreateConversation` without `conversationId`, assert the same record returns, and assert `listConversations` length remains one.

- [ ] **Step 2: Remove client-side generated initial IDs**

Set initial and reset `conversationId` to `""`; remove the unused `createConversationId` helper from the store.

- [ ] **Step 3: Keep explicit creation paths unchanged**

`handleNewConversation`, archive-current, and delete-current continue calling `createAssistantConversationAction` so user intent remains explicit.

- [ ] **Step 4: Run A505 and B21 GREEN**

Run:

```bash
node --test tests/a505-conversation-repository.test.mjs tests/b021-production-web-ai-reliability.test.mjs
```

Expected: all tests pass and no extra conversation is persisted.

### Task 5: Verify the complete Web risk boundary

**Files:**
- Modify as needed only when a test proves an in-scope regression.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: regression evidence for assistant, authentication, deployment recovery, and production configuration.

- [ ] **Step 1: Run focused assistant and auth regressions**

Run:

```bash
node apps/web/src/lib/web-ai-qa-guard.test.mjs
node --test tests/a505-conversation-repository.test.mjs tests/a523-production-fallback-removal.test.mjs tests/a524-auth-real-flow-contract.test.mjs tests/b021-production-web-ai-reliability.test.mjs
node --import tsx --test tests/b017-server-action-deployment-recovery.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run Web typecheck**

Run `pnpm --filter @learning-agent-platform/web typecheck`. Expected: exit 0.

- [ ] **Step 3: Run Web lint on changed source files**

Run ESLint against the changed TypeScript/TSX files. Expected: exit 0; unrelated repository warnings are reported separately.

- [ ] **Step 4: Run the production build**

Run `pnpm run build`. Expected: Next.js production build succeeds.

- [ ] **Step 5: Audit exact diff**

Run `git diff --check`, inspect every changed file, and verify no secret or unrelated dirty file is included.

- [ ] **Step 6: Verify protected-route public redirects**

Assert that middleware builds login URLs from a validated `APP_BASE_URL`, then verify production `/ai` and `/user` redirects use `https://cfagent.fun` rather than the reverse proxy's internal `localhost` origin.

- [ ] **Step 7: Audit all direct Provider construction paths**

Verify reliable Agent Loop, legacy multi-agent final aggregation, user-configured models, and background memory consolidation all evaluate the canonical Web AI guard before model calls. Verify Provider failures cannot enter ordinary messages, including tool-only fallback responses.

### Task 6: Document, commit, push, and deploy

**Files:**
- Create: `docs/rounds/codex/B21_codex.md`
- Modify: `docs/codex-context/CURRENT_HANDOFF.md` (B21 section only)
- Include: B21 design and plan files.

**Interfaces:**
- Consumes: verified implementation and exact local build.
- Produces: pushed GitHub commit and matching atomic production release.

- [ ] **Step 1: Write B21 round and handoff notes**

Record root cause, changed files, RED/GREEN output, build result, deployment commit, health result, AI two-turn smoke, empty-conversation count check, logs, and rollback.

- [ ] **Step 2: Stage and review only B21 scope**

Run `git diff --cached --name-only` and `git diff --cached --check`. Expected: only approved B21 files.

- [ ] **Step 3: Commit and push**

Commit with a focused message such as `fix: enable reliable production web ai`, then push the integrated main branch to `origin/main`.

- [ ] **Step 4: Deploy the exact pushed commit**

Use the existing atomic release process and locally built artifacts. Do not install or build on the server. Verify release Git SHA and build SHA before switching `current`.

- [ ] **Step 5: Perform production acceptance**

Verify health HTTP 200, service active, `/ai` and `/user` redirect to the public login URL when unauthenticated, ordinary AI response succeeds twice in sequence, no new empty conversation is created on page entry, and recent logs contain no new guard block or unhandled Server Action mismatch.

- [ ] **Step 6: Confirm repository/server parity**

Verify local HEAD, `origin/main`, release metadata, and `/opt/learning-agent-platform/current` all identify the same commit.
