import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const cronTemplate = readFileSync("deploy/cron/content-sync.example", "utf8");
const deploymentDoc = readFileSync("docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md", "utf8");

test("A526 content sync commands exist for all production sources", () => {
  assert.equal(typeof rootPackage.scripts["content:sync:hot"], "string");
  assert.equal(typeof rootPackage.scripts["content:sync:github-daily"], "string");
  assert.equal(typeof rootPackage.scripts["content:sync:articles"], "string");
  assert.equal(typeof rootPackage.scripts["content:sync:all"], "string");
});

test("A526 cron template schedules hot and articles every 6 hours and GitHub daily once", () => {
  assert.match(cronTemplate, /^15 \*\/6 \* \* \* .*pnpm content:sync:hot/m);
  assert.match(cronTemplate, /^5 \*\/6 \* \* \* .*pnpm content:sync:articles/m);
  assert.match(cronTemplate, /^35 2 \* \* \* .*pnpm content:sync:github-daily/m);
});

test("A526 cron template loads protected env and serializes jobs", () => {
  assert.match(cronTemplate, /source \/etc\/learning-agent-platform\/web\.env/);
  assert.match(cronTemplate, /\/usr\/bin\/flock -n \/tmp\/lap-content-sync-hot\.lock/);
  assert.match(cronTemplate, /\/usr\/bin\/flock -n \/tmp\/lap-content-sync-github\.lock/);
  assert.match(cronTemplate, /\/usr\/bin\/flock -n \/tmp\/lap-content-sync-articles\.lock/);
  assert.doesNotMatch(cronTemplate, /RESEND_API_KEY=|DATABASE_URL=postgresql:\/\/|LAP_INTERNAL_SCHEDULER_SECRET=/);
});

test("A526 deployment doc documents log rotation and backup restore rehearsal", () => {
  assert.match(deploymentDoc, /log rotation|日志|rotate/i);
  assert.match(deploymentDoc, /pg_restore/);
  assert.match(deploymentDoc, /prisma migrate deploy/);
  assert.match(deploymentDoc, /Do not use `prisma db push`, `prisma migrate reset`/);
});
