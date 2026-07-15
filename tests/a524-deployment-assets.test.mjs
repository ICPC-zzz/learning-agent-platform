import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nginx = readFileSync("deploy/nginx/cfagent.fun.conf.example", "utf8");
const systemd = readFileSync("deploy/systemd/learning-agent-platform.service.example", "utf8");
const syncService = readFileSync("deploy/systemd/learning-agent-platform-content-sync.service.example", "utf8");
const syncTimer = readFileSync("deploy/systemd/learning-agent-platform-content-sync.timer.example", "utf8");
const syncRunner = readFileSync("deploy/scripts/run-content-sync.sh.example", "utf8");
const dataPrepare = readFileSync("deploy/scripts/prepare-content-data.sh.example", "utf8");
const cron = readFileSync("deploy/cron/content-sync.example", "utf8");
const backup = readFileSync("deploy/scripts/backup-postgres.sh.example", "utf8");
const docs = readFileSync("docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md", "utf8");

test("A524 Nginx example preserves forwarded proto and host", () => {
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
  assert.match(nginx, /proxy_set_header Host \$host/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto https/);
  assert.doesNotMatch(nginx, /Domain=\.cfagent\.fun/);
});

test("A524 systemd services load protected env files without package-manager startup", () => {
  assert.match(systemd, /EnvironmentFile=\/etc\/learning-agent-platform\/web\.env/);
  assert.match(systemd, /ExecStart=\/usr\/bin\/node .*next\/dist\/bin\/next start/);
  assert.match(syncService, /EnvironmentFile=\/etc\/learning-agent-platform\/web\.env/);
  assert.match(syncService, /run-content-sync\.sh/);
  assert.match(syncTimer, /Persistent=true/);
  assert.match(syncRunner, /node_modules\/\.bin\/tsx/);
  assert.match(dataPrepare, /shared\/content-data/);
  assert.doesNotMatch(systemd + syncService + syncTimer + syncRunner + cron, /RESEND_API_KEY=/);
});

test("A524 deployment docs and backup avoid destructive commands", () => {
  assert.match(backup, /pg_dump/);
  assert.match(docs, /Ubuntu 24\.04/);
  assert.match(docs, /prisma migrate deploy/);
  assert.match(docs, /Cloudflare should be DNS-only/);
  assert.match(docs, /Do not use `prisma db push`, `prisma migrate reset`, or `git reset --hard`/);
  const deploymentAssets = nginx + systemd + syncService + syncTimer + syncRunner + dataPrepare + cron + backup;
  assert.doesNotMatch(deploymentAssets, /prisma db push/);
  assert.doesNotMatch(deploymentAssets, /migrate reset/);
  assert.doesNotMatch(deploymentAssets, /git reset --hard/);
});
