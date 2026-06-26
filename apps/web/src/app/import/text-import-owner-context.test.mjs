/**
 * Tests for text-import-owner-context contract.
 * Source inspection test.
 * @previewOnly
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push("FAIL: " + label); }
}

async function runTests() {
  console.log("=== text-import-owner-context.test.mjs ===");
  console.log("");

  const fs = await import("fs");
  const path = await import("path");
  const sourcePath = path.join(process.cwd(), "apps/web/src/app/import/text-import-owner-context.ts");
  const source = fs.readFileSync(sourcePath, "utf-8");

  assert(source.includes("resolveImportOwnerContext"), "1.1: exports resolveImportOwnerContext");
  assert(source.includes("createBlockedImportOwnerContext"), "1.2: exports createBlockedImportOwnerContext");
  assert(source.includes("importOwnerContextIsSafe"), "1.3: exports importOwnerContextIsSafe");

  assert(source.includes("ImportOwnerContext"), "2.1: defines ImportOwnerContext");
  assert(source.includes("hasOwner"), "2.2: has hasOwner field");
  assert(source.includes("ownerId"), "2.3: has ownerId field");
  assert(source.includes("safeToExposeToClient"), "2.4: has safeToExposeToClient");
  assert(source.includes("dev-only"), "2.5: mode is dev-only");

  assert(source.includes("SENSITIVE_CONTEXT_PATTERNS"), "3.1: has sensitive field patterns");
  assert(source.includes("importOwnerContextIsSafe"), "3.2: has safety check function");

  assert(!source.includes("process.env.DATABASE_URL"), "4.1: never reads raw DATABASE_URL");

  assert(source.includes("deserializeDevSession"), "5.1: reuses deserializeDevSession");
  assert(source.includes("getDevAuthGuardStatus"), "5.2: uses dev auth guard");
  assert(source.includes("evaluateImportDbPersistGuard"), "5.3: uses DB persist guard");

  assert(source.includes("dev session"), "6.1: mentions dev session");
  assert(source.includes("/login"), "6.2: mentions /login path");
  assert(source.includes("未接生产账号"), "6.3: mentions 未接生产账号");
  assert(!source.includes("云端同步完成"), "6.4: does NOT claim cloud sync complete");

  assert(source.includes("function resolveImportOwnerContext"), "7.1: has resolveImportOwnerContext fn");
  assert(source.includes("function createBlockedImportOwnerContext"), "7.2: has createBlockedImportOwnerContext fn");

  console.log("");
  console.log("Passed: " + passed);
  console.log("Failed: " + failed);
  if (failures.length > 0) {
    console.log("Failures:");
    failures.forEach(function(f) { console.log("  " + f); });
  }
  console.log("");
  if (failed > 0) process.exit(1);
}

runTests().catch(function(err) {
  console.error("Test error:", err);
  process.exit(1);
});
