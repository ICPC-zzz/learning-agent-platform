import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import test from "node:test";

const ROOT = cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf-8");

test("A518 content sync job exposes three unified sync operations", () => {
  const job = read("apps/web/src/lib/content/daily-content-sync-job.ts");
  assert.match(job, /syncDailyHotTopics/);
  assert.match(job, /syncGithubDailyReport/);
  assert.match(job, /syncTechnicalArticles/);
  assert.match(job, /syncAllDailyContent/);
  assert.match(job, /technical_articles/);
  assert.ok(job.indexOf("syncDailyHotTopics(options)") < job.indexOf("syncTechnicalArticles(options)"));
});

test("A518 admin sync actions require admin before running jobs", () => {
  const actions = read("apps/web/src/app/admin/sync/admin-sync-actions.ts");
  assert.match(actions, /requireAdmin/);
  assert.match(actions, /adminRefreshHotspots/);
  assert.match(actions, /adminRefreshGitHub/);
  assert.match(actions, /adminRefreshArticles/);
  assert.ok(actions.indexOf("await requireAdmin()", actions.indexOf("adminRefreshHotspots")) < actions.indexOf("syncDailyHotTopics", actions.indexOf("adminRefreshHotspots")));
  assert.ok(actions.indexOf("await requireAdmin()", actions.indexOf("adminRefreshGitHub")) < actions.indexOf("syncGithubDailyReport", actions.indexOf("adminRefreshGitHub")));
  assert.ok(actions.indexOf("await requireAdmin()", actions.indexOf("adminRefreshArticles")) < actions.indexOf("syncTechnicalArticles", actions.indexOf("adminRefreshArticles")));
});

test("A518 admin sync UI has three independent refresh buttons", () => {
  const page = read("apps/web/src/app/admin/sync/page.tsx");
  const client = read("apps/web/src/app/admin/sync/SyncManagementClient.tsx");
  assert.match(page, /adminRefreshArticles/);
  assert.match(client, /刷新每日热点/);
  assert.match(client, /刷新 GitHub 日报/);
  assert.match(client, /刷新技术文章/);
  assert.match(client, /最近尝试/);
  assert.match(client, /最近成功/);
  assert.match(client, /当前状态/);
});

test("A518 CLI content sync supports articles and builds db package first", () => {
  const rootPackage = read("package.json");
  const script = read("scripts/content-sync.ts");
  assert.match(rootPackage, /content:sync:articles/);
  assert.match(rootPackage, /@learning-agent-platform\/db build/);
  assert.match(script, /--articles/);
  assert.match(script, /syncTechnicalArticles/);
});
