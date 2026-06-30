import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const healthRoute = readFileSync("apps/web/src/app/api/health/route.ts", "utf8");

test("A524 health route returns safe ok database timestamp shape", () => {
  assert.match(healthRoute, /status: "ok"/);
  assert.match(healthRoute, /database: "ok"/);
  assert.match(healthRoute, /timestamp: new Date\(\)\.toISOString\(\)/);
});

test("A524 health route returns non-200 when database is unavailable", () => {
  assert.match(healthRoute, /hasDatabaseUrl/);
  assert.match(healthRoute, /\{ status: 503 \}/);
  assert.match(healthRoute, /SELECT 1/);
});

test("A524 health route does not expose secrets or internal paths", () => {
  assert.doesNotMatch(healthRoute, /DATABASE_URL/);
  assert.doesNotMatch(healthRoute, /RESEND_API_KEY/);
  assert.doesNotMatch(healthRoute, /process\.env/);
  assert.doesNotMatch(healthRoute, /version/);
});
