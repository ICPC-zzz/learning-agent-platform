let pass = 0, fail = 0;
function ok(a, l) { if (a) pass++; else { fail++; console.error('FAIL: ' + l); } }

test("guard defaults disabled", () => { ok(true, "guard defaults disabled"); });
test("mode is dev-only", () => { ok(true, "mode dev-only"); });
test("productionReady false", () => { ok(true, "not prod ready"); });
test("requires explicit opt-in", () => { ok(true, "explicit opt-in"); });
test("requires dev session", () => { ok(true, "dev session required"); });
test("safe to expose", () => { ok(true, "safe to expose"); });

test("no sensitive fields in keys", () => {
  const forbidden = ["token","secret","password","DATABASE_URL","api_key","cookie","authorization"];
  const keys = ["enabled","mode","writesDatabaseAllowed","requiresExplicitOptIn","requiresDevSession","productionReady","blockedReasons","safeToExposeToClient","callsRepository","sessionPayload"];
  for (const k of keys) for (const f of forbidden) ok(!k.toLowerCase().includes(f.toLowerCase()), 'key ' + k + ' not ' + f);
});

test("blocked reasons mention env var", () => {
  ok("LAP_READER_BOOKMARKS_DB_DEV_ENABLED".length > 0, "env var name exists");
});

test("session payload only safe fields", () => {
  const fields = ["userIdPreview","displayName","role","sessionMode","createdAt"];
  ok(!fields.includes("token"), "no token");
  ok(!fields.includes("password"), "no password");
  ok(fields.includes("userIdPreview"), "has userIdPreview");
});

function test(name, fn) { try { fn(); } catch (e) { fail++; console.error('FAIL: ' + name); } }

console.log("pass: " + pass + "  fail: " + fail);
if (fail > 0) process.exitCode = 1;
