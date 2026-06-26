import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const DAEMON = path.join(ROOT, "services/article-feed-ingestor/sync_daemon.py");

test("article sync daemon exposes a periodic loop", function () {
  const source = fs.readFileSync(DAEMON, "utf-8");
  assert.ok(source.includes("sync_articles"));
  assert.ok(source.includes("time.sleep"));
  assert.ok(source.includes("ARTICLE_SYNC_INTERVAL_MINUTES"));
  assert.ok(source.includes("--interval-minutes"));
  assert.ok(source.includes("--once"));
});
