import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(new URL("./page.tsx", import.meta.url));
const source = fs.readFileSync(filePath, "utf8");

test("/user renders only the Codeforces dashboard shell", function () {
  assert.ok(source.includes("CodeforcesDashboardClient"));
  assert.ok(source.includes("loadCodeforcesDashboard"));
  assert.ok(!source.includes("AI Native Learning Profile"));
  assert.ok(!source.includes("User Center"));
  assert.ok(!source.includes("AuthStatusCard"));
  assert.ok(!source.includes("UserDashboardUnifiedStatsHydration"));
  assert.ok(!source.includes("Recent Problems"));
  assert.ok(!source.includes("Favorite Problems"));
  assert.ok(!source.includes("A396 Learning Feedback"));
  assert.ok(!source.includes("A397 Learning Center"));
  assert.ok(!source.includes("A399 Daily Challenge"));
});
