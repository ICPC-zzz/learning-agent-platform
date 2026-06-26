import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));
var bulkSource = readFileSync(resolve(__dirname,"books","open-library-bulk-import-actions.ts"),"utf-8");
var catSource = readFileSync(resolve(__dirname,"books","programming-categories.ts"),"utf-8");

describe("A472 Open Library Bulk Import", function() {
  it("exports openLibraryBulkImportAction", function() {
    assert.ok(bulkSource.includes("export async function openLibraryBulkImportAction"));
  });
  it("getBulkImportCategories is in programming-categories.ts (NOT server file)", function() {
    assert.ok(catSource.includes("getBulkImportCategories"));
    assert.ok(!bulkSource.includes("export function getBulkImportCategories"));
  });
  it("MAX_BATCH_SIZE is 5", function() {
    var m = bulkSource.match(/const MAX_BATCH_SIZE\s*=\s*(\d+)/);
    assert.ok(m); assert.equal(parseInt(m[1]), 5);
  });
  it("imports PROGRAMMING_CATEGORIES", function() {
    assert.ok(bulkSource.includes('./programming-categories'));
    assert.ok(bulkSource.includes('PROGRAMMING_CATEGORIES['));
  });
  it("has 8 category keys in programming-categories.ts", function() {
    var count = 0;
    var keys = ["Python","JavaScript","Algorithm","Data Structures","Database","Web Dev","Machine Learning","System Design"];
    for (var i = 0; i < keys.length; i++) {
      if (catSource.indexOf(keys[i]) >= 0) count++;
    }
    assert.equal(count, 8, "should have all 8 categories, found " + count);
  });
  it("has required categories", function() {
    assert.ok(catSource.indexOf("Python") >= 0);
    assert.ok(catSource.indexOf("JavaScript") >= 0);
    assert.ok(catSource.indexOf("Database") >= 0);
    assert.ok(catSource.indexOf("Machine Learning") >= 0);
  });
  it("blocked result shape", function() {
    assert.ok(bulkSource.includes("totalRequested: 0"));
    assert.ok(bulkSource.includes("guardBlocked: true"));
  });
  it("safety: no raw response", function() {
    var r = bulkSource.replace(/rawResponseStored:\s*false/g, "");
    assert.ok(!r.includes("rawResponse"));
  });
  it("safety: env not exposed", function() {
    assert.ok(bulkSource.includes("envValuesExposed: false"));
  });
  it("safety: noFullText flag", function() {
    assert.ok(bulkSource.includes("noFullText: true"));
  });
  it("safety: productionReady false", function() {
    var m = bulkSource.match(/productionReady:\s*false/g);
    assert.ok(m && m.length >= 2);
  });
  it("uses A465 adapter", function() {
    assert.ok(bulkSource.includes("createOpenLibraryImportDraft"));
  });
  it("uses OL search client", function() {
    assert.ok(bulkSource.includes("searchOpenLibraryBooks"));
  });
});

console.log("A472 bulk import tests completed");
