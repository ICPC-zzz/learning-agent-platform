import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import test from "node:test";

const ROOT = cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf-8");

test("A518 admin authorization is centralized and server-side", () => {
  const auth = read("apps/web/src/lib/admin/admin-auth.ts");
  assert.match(auth, /getCurrentAuthSession/);
  assert.match(auth, /requireAdminUser/);
  assert.match(auth, /session\.role === "ADMIN"/);
  assert.match(auth, /requireAdmin/);
  assert.equal(auth.includes("LAP_ADMIN_EMAILS"), false);
  assert.equal(auth.includes("LAP_ADMIN_USER_IDS"), false);
  assert.equal(auth.includes("localStorage"), false);
  assert.equal(auth.includes('includes("admin")'), false);
});

test("A518 admin layout blocks non-admin users before rendering shell", () => {
  const layout = read("apps/web/src/app/admin/layout.tsx");
  assert.match(layout, /isCurrentUserAdmin/);
  assert.match(layout, /notFound\(\)/);
  assert.ok(layout.indexOf("isCurrentUserAdmin") < layout.indexOf("<AdminShell>"));
});

test("A518 user shell renders admin entry only from server-computed permission", () => {
  const root = read("apps/web/src/app/layout.tsx");
  const shell = read("apps/web/src/app/_components/AppShell.tsx");
  const header = read("apps/web/src/app/_components/AppHeader.tsx");
  const sidebar = read("apps/web/src/app/_components/AppSidebar.tsx");
  assert.match(root, /isCurrentUserAdmin/);
  assert.match(root, /canAccessAdmin=\{adminStatus\.ok\}/);
  assert.match(shell, /canAccessAdmin/);
  assert.match(header, /canAccessAdmin \? \(/);
  assert.match(sidebar, /canAccessAdmin \? \(/);
});
