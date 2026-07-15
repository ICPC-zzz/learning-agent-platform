# Reliable Daily Content Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle pnpm-based content cron with a persistent 06:00 Asia/Shanghai systemd timer, direct no-build execution, and release-independent generated content storage.

**Architecture:** A systemd timer activates one oneshot service. The service calls a small validated shell launcher that directly executes the existing TypeScript sync CLI through the already-installed `tsx` binary; a separate deployment helper moves `apps/web/src/data` behind a shared directory symlink so atomic release switches cannot roll generated content backward.

**Tech Stack:** systemd 255, Bash, Node.js/tsx, TypeScript, Node test runner, PostgreSQL/Prisma through existing sync code.

## Global Constraints

- Trigger once per day at `06:00:00 Asia/Shanghai`.
- Set `Persistent=true` so a missed activation runs after boot.
- Never run pnpm, dependency installation, Prisma generation, TypeScript compilation, or Next.js build from the scheduled service.
- Reuse the existing database lease, freshness checks, and previous-snapshot protection.
- Retry failures after 10 minutes, at most 3 attempts per hour.
- Persist generated content under `/opt/learning-agent-platform/shared/content-data`.
- Do not change fetch algorithms, database schema, public routes, or admin manual-sync behavior.
- Preserve unrelated dirty-worktree changes and stage only files belonging to this fix.

---

### Task 1: Add the failing deployment contract

**Files:**
- Create: `tests/b020-content-sync-systemd-timer.test.mjs`
- Modify: `tests/a524-deployment-assets.test.mjs`
- Modify: `tests/a526-content-scheduler-contract.test.mjs`

**Interfaces:**
- Consumes: deployment templates under `deploy/systemd`, `deploy/scripts`, and `deploy/cron`.
- Produces: a source-level contract proving schedule, catch-up, direct execution, bounded retry, persistent data setup, and cron retirement.

- [ ] **Step 1: Write the failing B20 test**

Create `tests/b020-content-sync-systemd-timer.test.mjs` with assertions that read these not-yet-created files:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const service = read("deploy/systemd/learning-agent-platform-content-sync.service.example");
const timer = read("deploy/systemd/learning-agent-platform-content-sync.timer.example");
const runner = read("deploy/scripts/run-content-sync.sh.example");
const prepare = read("deploy/scripts/prepare-content-data.sh.example");
const cron = read("deploy/cron/content-sync.example");

test("B20 timer runs daily at 06:00 Asia/Shanghai and catches missed runs", () => {
  assert.match(timer, /^OnCalendar=\*-\*-\* 06:00:00 Asia\/Shanghai$/m);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /^Unit=learning-agent-platform-content-sync\.service$/m);
});

test("B20 service directly runs the no-build launcher with bounded retries", () => {
  assert.match(service, /^Type=oneshot$/m);
  assert.match(service, /^ExecStart=\/opt\/learning-agent-platform\/current\/deploy\/scripts\/run-content-sync\.sh$/m);
  assert.match(service, /^Restart=on-failure$/m);
  assert.match(service, /^RestartSec=10min$/m);
  assert.match(service, /^StartLimitBurst=3$/m);
  assert.doesNotMatch(service, /pnpm|install|prisma generate|next build|\btsc\b/i);
});

test("B20 launcher executes the existing sync CLI without package-manager or build work", () => {
  assert.match(runner, /node_modules\/\.bin\/tsx/);
  assert.match(runner, /scripts\/content-sync\.ts/);
  assert.match(runner, /exec "\$TSX_BIN" "\$SYNC_SCRIPT"/);
  assert.doesNotMatch(runner, /pnpm|install|prisma generate|next build|\btsc\b/i);
});

test("B20 generated content is moved behind a shared directory symlink", () => {
  assert.match(prepare, /shared\/content-data/);
  assert.match(prepare, /apps\/web\/src\/data/);
  assert.match(prepare, /mv -- "\$RELEASE_DATA_DIR" "\$RELEASE_DEFAULTS_DIR"/);
  assert.match(prepare, /ln -s -- "\$SHARED_DATA_DIR" "\$RELEASE_DATA_DIR"/);
});

test("B20 legacy cron no longer schedules content sync", () => {
  assert.doesNotMatch(cron, /^[^#\n].*content:sync:/m);
  assert.match(cron, /learning-agent-platform-content-sync\.timer/);
});
```

- [ ] **Step 2: Run the B20 test and verify RED**

Run:

```bash
node --test tests/b020-content-sync-systemd-timer.test.mjs
```

Expected: FAIL with `ENOENT` for `learning-agent-platform-content-sync.service.example`.

- [ ] **Step 3: Update historical deployment contracts to describe the new scheduler**

Change the scheduler portions of `tests/a524-deployment-assets.test.mjs` and `tests/a526-content-scheduler-contract.test.mjs` to read the new service, timer, runner, and prepare templates. Keep their unrelated backup, migration, secret-leak, and deployment checks intact. Their scheduler assertions must match the B20 requirements and must not require active content lines in the legacy cron template.

- [ ] **Step 4: Run historical contracts and verify they fail for missing templates**

Run:

```bash
node --test tests/a524-deployment-assets.test.mjs tests/a526-content-scheduler-contract.test.mjs
```

Expected: FAIL because the systemd content-sync templates do not exist yet.

### Task 2: Implement direct systemd scheduling

**Files:**
- Create: `deploy/systemd/learning-agent-platform-content-sync.service.example`
- Create: `deploy/systemd/learning-agent-platform-content-sync.timer.example`
- Create: `deploy/scripts/run-content-sync.sh.example`
- Modify: `deploy/cron/content-sync.example`

**Interfaces:**
- Consumes: `/opt/learning-agent-platform/current`, `/etc/learning-agent-platform/web.env`, current `node_modules/.bin/tsx`, `packages/db/dist/index.js`, and `scripts/content-sync.ts`.
- Produces: `learning-agent-platform-content-sync.service` and `.timer`; launcher exits with the existing sync CLI's exit code.

- [ ] **Step 1: Add the oneshot service template**

Create the service with:

```ini
[Unit]
Description=Learning Agent Platform Daily Content Sync
After=network-online.target postgresql.service
Wants=network-online.target
StartLimitIntervalSec=1h
StartLimitBurst=3

[Service]
Type=oneshot
User=APP_USER
Group=APP_USER
WorkingDirectory=/opt/learning-agent-platform/current
EnvironmentFile=/etc/learning-agent-platform/web.env
Environment=NODE_ENV=production
ExecStart=/opt/learning-agent-platform/current/deploy/scripts/run-content-sync.sh
Restart=on-failure
RestartSec=10min
TimeoutStartSec=30min
Nice=10
NoNewPrivileges=true
PrivateTmp=true
```

- [ ] **Step 2: Add the persistent timer template**

Create the timer with:

```ini
[Unit]
Description=Run Learning Agent Platform content sync every day at 06:00 China time

[Timer]
OnCalendar=*-*-* 06:00:00 Asia/Shanghai
Persistent=true
AccuracySec=1min
Unit=learning-agent-platform-content-sync.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: Add the direct launcher**

Create an executable Bash template that validates inputs and ends with:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/learning-agent-platform/current"
TSX_BIN="$APP_ROOT/node_modules/.bin/tsx"
SYNC_SCRIPT="$APP_ROOT/scripts/content-sync.ts"
DB_ENTRY="$APP_ROOT/packages/db/dist/index.js"

if [[ ! -x "$TSX_BIN" ]]; then
  echo "content sync runtime missing: tsx" >&2
  exit 70
fi
if [[ ! -f "$SYNC_SCRIPT" ]]; then
  echo "content sync runtime missing: sync script" >&2
  exit 70
fi
if [[ ! -f "$DB_ENTRY" ]]; then
  echo "content sync runtime missing: database build artifact" >&2
  exit 70
fi

cd "$APP_ROOT"
exec "$TSX_BIN" "$SYNC_SCRIPT"
```

- [ ] **Step 4: Retire the legacy content cron template**

Replace active content lines with comments that direct operators to install `learning-agent-platform-content-sync.timer`. Keep `SHELL` and `PATH` only if useful for migration documentation; no uncommented line may contain `content:sync:`.

- [ ] **Step 5: Run scheduler contracts and verify GREEN**

Run:

```bash
node --test tests/b020-content-sync-systemd-timer.test.mjs tests/a524-deployment-assets.test.mjs tests/a526-content-scheduler-contract.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Validate the systemd calendar expression**

Run locally if systemd tools are available, otherwise run read-only on the server:

```bash
systemd-analyze calendar '*-*-* 06:00:00 Asia/Shanghai'
```

Expected: normalized calendar shows `06:00:00 CST` and the next trigger is the next China-time 06:00.

### Task 3: Implement release-independent generated data

**Files:**
- Create: `deploy/scripts/prepare-content-data.sh.example`
- Modify: `docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md`

**Interfaces:**
- Consumes: a release root argument, default `/opt/learning-agent-platform/current`.
- Produces: `/opt/learning-agent-platform/shared/content-data` and a directory symlink at `<release>/apps/web/src/data`.

- [ ] **Step 1: Add the persistent-data preparation script**

Create:

```bash
#!/usr/bin/env bash
set -euo pipefail

RELEASE_ROOT="${1:-/opt/learning-agent-platform/current}"
SHARED_DATA_DIR="/opt/learning-agent-platform/shared/content-data"
RELEASE_DATA_DIR="$RELEASE_ROOT/apps/web/src/data"
RELEASE_DEFAULTS_DIR="$RELEASE_ROOT/apps/web/src/data.release-defaults"

if [[ ! -d "$RELEASE_ROOT/apps/web/src" ]]; then
  echo "invalid release root: $RELEASE_ROOT" >&2
  exit 64
fi

mkdir -p -- "$SHARED_DATA_DIR"

if [[ -L "$RELEASE_DATA_DIR" ]]; then
  [[ "$(readlink -f -- "$RELEASE_DATA_DIR")" == "$(readlink -f -- "$SHARED_DATA_DIR")" ]] || {
    echo "content data symlink points to an unexpected directory" >&2
    exit 65
  }
  exit 0
fi

if [[ ! -d "$RELEASE_DATA_DIR" ]]; then
  echo "release content data directory is missing" >&2
  exit 66
fi

for source_file in "$RELEASE_DATA_DIR"/*.json; do
  [[ -e "$source_file" ]] || continue
  target_file="$SHARED_DATA_DIR/$(basename -- "$source_file")"
  if [[ ! -e "$target_file" ]]; then
    cp -- "$source_file" "$target_file"
  fi
done

mv -- "$RELEASE_DATA_DIR" "$RELEASE_DEFAULTS_DIR"
ln -s -- "$SHARED_DATA_DIR" "$RELEASE_DATA_DIR"
```

This is directory-level linking so the article ingestor's atomic file replacement remains inside persistent storage.

- [ ] **Step 2: Document installation, release linking, logs, and rollback**

Update `docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md` with exact commands to:

```bash
install -m 0755 deploy/scripts/run-content-sync.sh.example deploy/scripts/run-content-sync.sh
install -m 0755 deploy/scripts/prepare-content-data.sh.example deploy/scripts/prepare-content-data.sh
./deploy/scripts/prepare-content-data.sh /opt/learning-agent-platform/current
sudo install -m 0644 deploy/systemd/learning-agent-platform-content-sync.service.example /etc/systemd/system/learning-agent-platform-content-sync.service
sudo install -m 0644 deploy/systemd/learning-agent-platform-content-sync.timer.example /etc/systemd/system/learning-agent-platform-content-sync.timer
sudo systemctl daemon-reload
sudo systemctl enable --now learning-agent-platform-content-sync.timer
```

Document environment-path placeholder replacement, removal of old content cron lines, `systemctl list-timers`, `journalctl`, manual catch-up, and timer disable rollback.

- [ ] **Step 3: Run all deployment contract tests**

Run:

```bash
node --test tests/b020-content-sync-systemd-timer.test.mjs tests/a524-deployment-assets.test.mjs tests/a526-content-scheduler-contract.test.mjs
```

Expected: all tests PASS with zero failures.

### Task 4: Validate and publish the repository change

**Files:**
- Create: `docs/rounds/codex/B20_codex.md`
- Modify: `docs/codex-context/CURRENT_HANDOFF.md` (B20 section only)
- Include: `docs/superpowers/plans/2026-07-15-content-sync-systemd-timer.md`

**Interfaces:**
- Consumes: Tasks 1-3 outputs.
- Produces: committed and pushed deployment assets plus a focused handoff record.

- [ ] **Step 1: Run focused tests and shell syntax checks**

Run:

```bash
node --test tests/b020-content-sync-systemd-timer.test.mjs tests/a524-deployment-assets.test.mjs tests/a526-content-scheduler-contract.test.mjs
bash -n deploy/scripts/run-content-sync.sh.example
bash -n deploy/scripts/prepare-content-data.sh.example
```

Expected: tests report zero failures; both Bash checks exit 0.

- [ ] **Step 2: Run web typecheck and production build in the isolated build worktree**

Run the workspace's direct TypeScript and Next entry points so pnpm does not reconcile the user's dirty dependency tree:

```text
node <workspace-node_modules>/typescript/bin/tsc --noEmit
node <workspace-node_modules>/next/dist/bin/next build --no-lint
```

Expected: both exit 0. Existing unrelated warnings must be reported, not hidden.

- [ ] **Step 3: Write B20 round and handoff notes**

Record root cause, changed files, RED/GREEN evidence, server migration commands, immediate catch-up result, resource usage, and rollback. Do not edit unrelated C-series handoff content.

- [ ] **Step 4: Review the exact staged scope**

Run:

```bash
git diff --cached --name-only
git diff --cached --check
```

Expected: only B20 scheduler files, focused historical contract updates, deployment docs, plan, round note, and B20 handoff hunk are staged.

- [ ] **Step 5: Commit and push**

```bash
git commit -m "fix: make daily content sync release-safe"
git push origin main
```

Expected: push updates `origin/main` to the new commit without including unrelated worktree changes.

### Task 5: Install, catch up, and verify production

**Files:**
- Server: `/etc/systemd/system/learning-agent-platform-content-sync.service`
- Server: `/etc/systemd/system/learning-agent-platform-content-sync.timer`
- Server: `/opt/learning-agent-platform/shared/content-data`
- Server: `/etc/cron.d/learning-agent-platform`

**Interfaces:**
- Consumes: exact pushed commit and locally built `.next` artifact.
- Produces: running Web release, enabled daily timer, current 2026-07-15 content, persistent generated data.

- [ ] **Step 1: Deploy the exact commit with the existing atomic release process**

Clone the exact pushed commit, attach approved dependency artifacts, attach shared `.data`, run `prepare-content-data.sh`, upload the locally built `.next`, verify commit/build IDs, then atomically switch `/opt/learning-agent-platform/current`. Do not install dependencies or build on the server.

- [ ] **Step 2: Install units and retire only content cron lines**

Replace `APP_USER`/`APP_ENV_FILE` placeholders for production, install both units, remove the three content-sync lines from `/etc/cron.d/learning-agent-platform` while retaining the PostgreSQL backup line, daemon-reload, and enable/start the timer.

- [ ] **Step 3: Validate units before execution**

Run:

```bash
systemd-analyze verify /etc/systemd/system/learning-agent-platform-content-sync.service /etc/systemd/system/learning-agent-platform-content-sync.timer
systemctl list-timers learning-agent-platform-content-sync.timer --all
```

Expected: verify exits 0 and next trigger is the next `06:00 CST`.

- [ ] **Step 4: Run the immediate catch-up**

Run:

```bash
sudo systemctl start learning-agent-platform-content-sync.service
sudo systemctl status learning-agent-platform-content-sync.service --no-pager
sudo journalctl -u learning-agent-platform-content-sync.service -n 100 --no-pager
```

Expected: service exits successfully; output contains all three result kinds with `succeeded` or a valid freshness `skipped`, and no package installation/build output.

- [ ] **Step 5: Verify page data, persistence, health, and resources**

Verify database latest dates and generated-file timestamps are 2026-07-15, `https://cfagent.fun/api/health` returns HTTP 200, the article page shows current sync metadata, `apps/web/src/data` resolves to shared storage, and no `pnpm install`, `next build`, `tsc`, or `prisma generate` process remains. Record load average and top CPU processes.

- [ ] **Step 6: Verify rollback readiness**

Confirm the previous release remains available, a backup of the old cron file exists, and disabling the timer does not delete shared content data.
