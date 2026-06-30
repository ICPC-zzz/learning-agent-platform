import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("packages/db/prisma/schema.prisma", "utf8");
const adminAuth = readFileSync("apps/web/src/lib/admin/admin-auth.ts", "utf8");
const bootstrap = readFileSync("scripts/auth-bootstrap-admin.ts", "utf8");

test("A522 User role is database RBAC with USER default", () => {
  assert.match(schema, /enum UserRole[\s\S]*USER[\s\S]*ADMIN/);
  assert.match(schema, /role\s+UserRole\s+@default\(USER\)/);
});

test("A522 admin auth uses database session role, not request whitelist", () => {
  assert.match(adminAuth, /requireAdminUser/);
  assert.match(adminAuth, /session\.role === "ADMIN"/);
  assert.doesNotMatch(adminAuth, /LAP_ADMIN_EMAILS/);
  assert.doesNotMatch(adminAuth, /LAP_ADMIN_USER_IDS/);
});

test("A522 admin bootstrap is env-driven and only updates existing users", () => {
  assert.match(bootstrap, /process\.env\.LAP_ADMIN_EMAILS/);
  assert.match(bootstrap, /getUserByEmail\(email\)/);
  assert.match(bootstrap, /updateUser\(user\.id,\s*{\s*role:\s*"ADMIN"\s*}\)/);
  assert.doesNotMatch(bootstrap, /createUser/);
});
