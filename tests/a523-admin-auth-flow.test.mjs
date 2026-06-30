import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("packages/db/prisma/schema.prisma", "utf8");
const adminAuth = readFileSync("apps/web/src/lib/admin/admin-auth.ts", "utf8");
const adminLayout = readFileSync("apps/web/src/app/admin/layout.tsx", "utf8");
const syncActions = readFileSync("apps/web/src/app/admin/sync/admin-sync-actions.ts", "utf8");
const bootstrap = readFileSync("scripts/auth-bootstrap-admin.ts", "utf8");
const appHeader = readFileSync("apps/web/src/app/_components/AppHeader.tsx", "utf8");
const appShell = readFileSync("apps/web/src/app/_components/AppShell.tsx", "utf8");
const rootLayout = readFileSync("apps/web/src/app/layout.tsx", "utf8");

test("A523 admin RBAC is backed by database User.role", () => {
  assert.match(schema, /enum UserRole[\s\S]*USER[\s\S]*ADMIN/);
  assert.match(schema, /role\s+UserRole\s+@default\(USER\)/);
  assert.match(adminAuth, /requireAdminUser/);
  assert.match(adminAuth, /session\.role === "ADMIN"/);
  assert.doesNotMatch(adminAuth, /LAP_ADMIN_EMAILS/);
});

test("A523 admin routes and actions require admin session", () => {
  assert.match(adminLayout, /isCurrentUserAdmin/);
  assert.match(adminLayout, /notFound\(\)/);
  assert.match(syncActions, /requireAdmin/);
  assert.match(syncActions, /toAdminActionDeniedResult/);
});

test("A523 admin bootstrap promotes only existing allowlisted users", () => {
  assert.match(bootstrap, /process\.env\.LAP_ADMIN_EMAILS/);
  assert.match(bootstrap, /getUserByEmail\(email\)/);
  assert.match(bootstrap, /updateUser\(user\.id,\s*\{\s*role:\s*"ADMIN"\s*\}\)/);
  assert.doesNotMatch(bootstrap, /createUser/);
});

test("A523 header exposes admin entry from authenticated database role", () => {
  assert.match(adminAuth, /session\.role === "ADMIN"/);
  assert.match(rootLayout, /isCurrentUserAdmin\(\)/);
  assert.match(rootLayout, /canAccessAdmin=\{adminStatus\.ok\}/);
  assert.match(appShell, /canAccessAdmin/);
  assert.match(appHeader, /canAccessAdmin/);
  assert.match(appHeader, /后台/);
  assert.doesNotMatch(appHeader, /LAP_ADMIN_EMAILS/);
});
