import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nginx = readFileSync("deploy/nginx/cfagent.fun.conf.example", "utf8");
const systemd = readFileSync("deploy/systemd/learning-agent-platform.service.example", "utf8");
const cron = readFileSync("deploy/cron/content-sync.example", "utf8");
const backup = readFileSync("deploy/scripts/backup-postgres.sh.example", "utf8");
const docs = readFileSync("docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md", "utf8");

test("A524 Nginx example preserves forwarded proto and host", () => {
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
  assert.match(nginx, /proxy_set_header Host \$host/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto https/);
  assert.doesNotMatch(nginx, /Domain=\.cfagent\.fun/);
});

test("A524 systemd and cron load protected env files", () => {
  assert.match(systemd, /EnvironmentFile=\/etc\/learning-agent-platform\/web\.env/);
  assert.match(systemd, /pnpm --filter @learning-agent-platform\/web start/);
  assert.match(cron, /source \/etc\/learning-agent-platform\/web\.env/);
  assert.match(cron, /flock/);
  assert.doesNotMatch(cron, /RESEND_API_KEY=/);
});

test("A524 deployment docs and backup avoid destructive commands", () => {
  assert.match(backup, /pg_dump/);
  assert.match(docs, /Ubuntu 24\.04/);
  assert.match(docs, /prisma migrate deploy/);
  assert.match(docs, /Cloudflare should be DNS-only/);
  assert.match(docs, /Do not use `prisma db push`, `prisma migrate reset`, or `git reset --hard`/);
  assert.doesNotMatch(nginx + systemd + cron + backup, /prisma db push/);
  assert.doesNotMatch(nginx + systemd + cron + backup, /migrate reset/);
  assert.doesNotMatch(nginx + systemd + cron + backup, /git reset --hard/);
});
