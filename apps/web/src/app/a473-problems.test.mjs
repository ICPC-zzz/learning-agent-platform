import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path) {
  const full = resolve(__dirname, path);
  if (!existsSync(full)) {
    return null;
  }

  return readFileSync(full, "utf-8");
}

function count(source, pattern) {
  if (!source) {
    return 0;
  }

  const re = typeof pattern === "string" ? new RegExp(pattern, "gi") : pattern;
  const matches = source.match(re);
  return matches ? matches.length : 0;
}

const pageSource = readSource("problems/page.tsx");
const searchSource = readSource("problems/components/CodeforcesSearchClient.tsx");
const previewClientSource = readSource("problems/ProblemApiPreviewClient.tsx");
const eligibilitySource = readSource("import/problem-import-eligibility.ts");
const importActionSource = readSource("import/problem-api-import-server-action.ts");
const cleanupScriptSource = readSource("../scripts/delete-codeforces-imported-problems.mjs");

describe("A473 problem center platform boundaries", () => {
  it("switches the problem center to Codeforces metadata browsing", () => {
    assert.ok(pageSource?.includes("Codeforces 题目中心"));
    assert.ok(pageSource?.includes("Codeforces 题目列表"));
    assert.equal(pageSource?.includes("CodeforcesSearchClient"), false);
    assert.equal(pageSource?.includes("evaluateCodeforcesGuard"), false);
    assert.equal(pageSource?.includes("CodeforcesBulkImportClient"), false);
    assert.equal(pageSource?.includes("evaluateDevProblemImportGuard"), false);
  });

  it("search client only opens original Codeforces links", () => {
    assert.ok(searchSource?.includes("在 Codeforces 打开") || searchSource?.includes("在原站打开"));
    assert.equal(searchSource?.includes("importCodeforcesProblemAction"), false);
    assert.equal(searchSource?.includes("bulkImportCodeforcesAction"), false);
  });

  it("problem import eligibility requires complete non-interactive problems", () => {
    assert.ok(eligibilitySource?.includes("完整题面"));
    assert.ok(eligibilitySource?.includes("输入说明"));
    assert.ok(eligibilitySource?.includes("输出说明"));
    assert.ok(eligibilitySource?.includes("样例"));
    assert.ok(eligibilitySource?.includes("非交互题"));
  });

  it("preview client uses the import eligibility gate", () => {
    assert.ok(previewClientSource?.includes("evaluateProblemImportEligibility"));
    assert.ok(previewClientSource?.includes("导入到本地库"));
    assert.ok(previewClientSource?.includes("不可导入"));
  });

  it("import action blocks incomplete items and does not fall back to localStorage", () => {
    assert.ok(importActionSource?.includes("evaluateProblemImportEligibility"));
    assert.ok(importActionSource?.includes("not-importable"));
    assert.equal(importActionSource?.includes("localStorage"), false);
    assert.equal(importActionSource?.includes("local-storage-only"), false);
  });

  it("cleanup script deletes codeforces imported problems and related records", () => {
    assert.ok(cleanupScriptSource);
    assert.ok(cleanupScriptSource.includes("Codeforces cleanup"));
    assert.ok(cleanupScriptSource?.includes("problemPracticeActivity"));
    assert.ok(cleanupScriptSource?.includes("problemFavorite"));
    assert.ok(cleanupScriptSource?.includes("learningActivity"));
    assert.ok(cleanupScriptSource?.includes("problemWrongBook"));
    assert.ok(cleanupScriptSource?.includes("dailyRecommendation"));
    assert.ok(count(cleanupScriptSource, "deleteMany") >= 6);
  });
});
