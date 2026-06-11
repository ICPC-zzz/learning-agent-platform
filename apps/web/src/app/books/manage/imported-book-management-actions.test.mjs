/**
 * Tests for imported-book-management-actions contract.
 * Source inspection test - matches project convention.
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
  console.log("=== imported-book-management-actions.test.mjs ===");
  console.log("");

  const fs = await import("fs");
  const path = await import("path");
  const sourcePath = path.join(process.cwd(), "apps/web/src/app/books/manage/actions.ts");
  const source = fs.readFileSync(sourcePath, "utf-8");

  assert(source.includes("use server"), "1.1: is a server action module");
  assert(source.includes("renameImportedBook"), "1.2: exports renameImportedBook");
  assert(source.includes("archiveImportedBook"), "1.3: exports archiveImportedBook");
  assert(source.includes("isDevAuthAllowed"), "2.1: checks dev auth guard");
  assert(source.includes("isImportDbPersistEnabled"), "2.2: checks DB persist guard");
  assert(source.includes("lap-web-dev-session"), "3.1: reads dev session cookie");
  assert(source.includes("resolveImportOwnerContext"), "3.2: resolve owner context");
  assert(source.includes("title-empty"), "4.1: blocks empty title");
  assert(source.includes("title-too-long"), "4.2: blocks too-long title");
  assert(source.includes("MAX_TITLE_LENGTH"), "4.3: has max length");
  assert(source.includes("FORBIDDEN_TITLE_PATTERNS"), "5.1: forbidden patterns");
  assert(source.includes("requestedByOwnerId"), "6.1: ownerId");
  assert(source.includes("archiveImportedBook"), "7.1: archive function");
  assert(source.includes("redactSensitive"), "8.1: redactSensitive");
  assert(source.includes("SENSITIVE_PATTERNS"), "8.2: sensitive patterns");
  assert(source.includes("RenameBookActionResult"), "9.1: rename result type");
  assert(source.includes("safeToExposeToClient"), "9.2: safeToExpose");
  assert(source.includes("ArchiveBookActionResult"), "10.1: archive result type");
  assert(!source.includes("process.env.DATABASE_URL"), "11.1: no raw DATABASE_URL");

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
