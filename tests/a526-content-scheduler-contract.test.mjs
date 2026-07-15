import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const cronTemplate = readFileSync("deploy/cron/content-sync.example", "utf8");
const serviceTemplate = readFileSync("deploy/systemd/learning-agent-platform-content-sync.service.example", "utf8");
const timerTemplate = readFileSync("deploy/systemd/learning-agent-platform-content-sync.timer.example", "utf8");
const runnerTemplate = readFileSync("deploy/scripts/run-content-sync.sh.example", "utf8");
const prepareTemplate = readFileSync("deploy/scripts/prepare-content-data.sh.example", "utf8");
const deploymentDoc = readFileSync("docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md", "utf8");

test("A526 content sync commands exist for all production sources", () => {
  assert.equal(typeof rootPackage.scripts["content:sync:hot"], "string");
  assert.equal(typeof rootPackage.scripts["content:sync:github-daily"], "string");
  assert.equal(typeof rootPackage.scripts["content:sync:articles"], "string");
  assert.equal(typeof rootPackage.scripts["content:sync:all"], "string");
});

test("A526 systemd timer schedules one persistent 06:00 Asia/Shanghai batch", () => {
  assert.match(timerTemplate, /^OnCalendar=\*-\*-\* 06:00:00 Asia\/Shanghai$/m);
  assert.match(timerTemplate, /^Persistent=true$/m);
  assert.match(timerTemplate, /learning-agent-platform-content-sync\.service/);
});

test("A526 scheduled sync uses protected env and direct no-build execution", () => {
  assert.match(serviceTemplate, /EnvironmentFile=\/etc\/learning-agent-platform\/web\.env/);
  assert.match(serviceTemplate, /run-content-sync\.sh/);
  assert.match(runnerTemplate, /node_modules\/\.bin\/tsx/);
  assert.match(runnerTemplate, /scripts\/content-sync\.ts/);
  assert.doesNotMatch(serviceTemplate + runnerTemplate, /pnpm|install|prisma generate|next build|\btsc\b/i);
  assert.doesNotMatch(serviceTemplate + runnerTemplate, /RESEND_API_KEY=|DATABASE_URL=postgresql:\/\/|LAP_INTERNAL_SCHEDULER_SECRET=/);
});

test("A526 generated content persists across releases and legacy cron is retired", () => {
  assert.match(prepareTemplate, /shared\/content-data/);
  assert.match(prepareTemplate, /apps\/web\/src\/data/);
  assert.doesNotMatch(cronTemplate, /^[^#\n].*content:sync:/m);
  assert.match(cronTemplate, /learning-agent-platform-content-sync\.timer/);
});

test("A526 deployment doc documents log rotation and backup restore rehearsal", () => {
  assert.match(deploymentDoc, /log rotation|日志|rotate/i);
  assert.match(deploymentDoc, /pg_restore/);
  assert.match(deploymentDoc, /prisma migrate deploy/);
  assert.match(deploymentDoc, /Do not use `prisma db push`, `prisma migrate reset`/);
});
