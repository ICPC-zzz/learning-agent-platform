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
