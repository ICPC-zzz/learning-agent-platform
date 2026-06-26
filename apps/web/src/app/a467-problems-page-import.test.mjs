import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path) {
  return readFileSync(resolve(__dirname, path), "utf-8");
}

const eligibilitySource = readSource("import/problem-import-eligibility.ts");
const importActionSource = readSource("import/problem-api-import-server-action.ts");

describe("A467 import eligibility and DB-only import gate", () => {
  it("requires full statement, input/output description, samples, and non-interactive problems", () => {
    assert.ok(eligibilitySource.includes("完整题面"));
    assert.ok(eligibilitySource.includes("输入说明"));
    assert.ok(eligibilitySource.includes("输出说明"));
    assert.ok(eligibilitySource.includes("样例"));
    assert.ok(eligibilitySource.includes("非交互题"));
  });

  it("keeps the interactive problem detector", () => {
    assert.ok(eligibilitySource.includes("interactive"));
    assert.ok(eligibilitySource.includes("交互题"));
  });

  it("blocks incomplete imports before any DB write", () => {
    assert.ok(importActionSource.includes("evaluateProblemImportEligibility"));
    assert.ok(importActionSource.includes("not-importable"));
    assert.ok(importActionSource.includes("db-persist-disabled"));
    assert.ok(importActionSource.includes("existing-db"));
  });

  it("does not fall back to localStorage in the import action", () => {
    assert.equal(importActionSource.includes("localStorage"), false);
    assert.equal(importActionSource.includes("local-storage-only"), false);
  });
});
