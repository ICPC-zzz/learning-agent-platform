import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const bootstrap = readFileSync("scripts/auth-bootstrap-admin.ts", "utf8");

test("A526 auth:bootstrap-admin does not implicitly build DB or run prisma generate", () => {
  assert.equal(rootPackage.scripts["auth:bootstrap-admin"], "tsx scripts/auth-bootstrap-admin.ts");
  assert.doesNotMatch(rootPackage.scripts["auth:bootstrap-admin"], /db build|prisma generate/);
});

test("A526 admin bootstrap safely exits before DB load when allowlist is empty", () => {
  const envIndex = bootstrap.indexOf("parseEmailList(process.env.LAP_ADMIN_EMAILS)");
  const loadIndex = bootstrap.indexOf("await loadDbPackage()");
  assert.ok(envIndex >= 0, "bootstrap must parse LAP_ADMIN_EMAILS");
  assert.ok(loadIndex >= 0, "bootstrap must load the DB package when needed");
  assert.ok(envIndex < loadIndex, "empty allowlist must exit before loading DB");
  assert.match(bootstrap, /未配置 LAP_ADMIN_EMAILS，未变更任何用户。/);
});

test("A526 admin bootstrap reports missing generated DB package with recovery guidance", () => {
  assert.match(bootstrap, /packages\/db\/dist\/index\.js/);
  assert.match(bootstrap, /无法加载已生成的 DB 包/);
  assert.match(bootstrap, /pnpm --filter @learning-agent-platform\/db build/);
  assert.match(bootstrap, /默认不会自动运行 prisma generate/);
});

test("A526 admin bootstrap is idempotent and does not print raw full allowlist by default", () => {
  assert.match(bootstrap, /user\.role === "ADMIN"/);
  assert.match(bootstrap, /无需变更/);
  assert.match(bootstrap, /maskEmail\(email\)/);
  assert.doesNotMatch(bootstrap, /console\.log\(`[^`]*\$\{email\}/);
});
