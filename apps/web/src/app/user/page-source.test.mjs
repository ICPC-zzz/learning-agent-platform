import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, "page.tsx");
const source = fs.readFileSync(filePath, "utf8");

test("/user renders Codeforces dashboard with current module structure", function () {
  assert.ok(source.includes("CodeforcesDashboardClient"), "should include CodeforcesDashboardClient");
  assert.ok(source.includes("loadCodeforcesDashboard"), "should include loadCodeforcesDashboard");
  // Current /user page is a visible personal center preview (no forced redirect for unauthenticated)
  assert.ok(!source.includes("AI Native Learning Profile"), "no old AI Native branding");
  assert.ok(!source.includes("User Center"), "no old User Center");
  assert.ok(!source.includes("AuthStatusCard"), "no old auth card");
  assert.ok(!source.includes("Recent Problems"), "no old Recent Problems section");
  assert.ok(!source.includes("Favorite Problems"), "no old Favorite Problems section");
  assert.ok(!source.includes("A396 Learning Feedback"), "no old A396 feedback");
  assert.ok(!source.includes("A397 Learning Center"), "no old A397 center");
  assert.ok(!source.includes("A399 Daily Challenge"), "no old A399 daily challenge");
});
