/**
 * Tests for imported-books-management-view-model contract.
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
  console.log("=== imported-books-management-view-model.test.mjs ===");
  console.log("");

  const fs = await import("fs");
  const path = await import("path");
  const sourcePath = path.join(process.cwd(), "apps/web/src/app/books/manage/imported-books-management-view-model.ts");
  const source = fs.readFileSync(sourcePath, "utf-8");

  assert(source.includes("buildImportedBooksManagementViewModel"), "1.1: exports buildImportedBooksManagementViewModel");
  assert(source.includes("ImportedBooksManagementViewModel"), "1.2: defines view model type");
  assert(source.includes("ImportedBookSummary"), "1.3: defines book summary type");

  assert(source.includes("no-session"), "2.1: handles no-session state");
  assert(source.includes("db-persist-disabled"), "2.2: handles db-persist-disabled state");
  assert(source.includes("no-db-url"), "2.3: handles no-db-url state");
  assert(source.includes("no-books"), "2.4: handles no-books state");
  assert(source.includes("loaded"), "2.5: handles loaded state");
  assert(source.includes("error"), "2.6: handles error state");

  assert(source.includes("evaluateImportDbPersistGuard"), "3.1: uses DB persist guard");
  assert(source.includes("resolveImportOwnerContext"), "3.2: uses owner context");
  assert(source.includes("hasDatabaseUrl"), "3.3: checks DATABASE_URL");

  assert(source.includes("ownerId"), "4.1: filters by ownerId");
  assert(source.includes("listBooks"), "4.2: calls listBooks with ownerId");

  assert(source.includes("dev"), "5.1: mentions dev");
  assert(!source.includes("production user library"), "5.2: safe label");

  assert(!source.includes("process.env.DATABASE_URL"), "6.1: never reads raw DATABASE_URL");
  assert(!source.includes("cookieStore.get"), "6.2: does not read cookies directly");

  assert(source.includes("isArchived"), "7.1: tracks archive status");
  assert(source.includes("archived"), "7.2: uses archived status label");

  assert(source.includes("safeToExposeToClient"), "8.1: has safeToExposeToClient flag");

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
