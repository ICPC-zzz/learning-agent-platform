import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path) {
  return readFileSync(resolve(__dirname, path), "utf-8");
}

const pageSource = readSource("problems/page.tsx");
const searchSource = readSource("problems/components/CodeforcesSearchClient.tsx");

describe("A466 Problems page platform library", () => {
  it("switches the problem center to Codeforces metadata library", () => {
    assert.ok(pageSource.includes("Codeforces 题目中心"));
    assert.ok(pageSource.includes("Codeforces 题目列表"));
    assert.ok(pageSource.includes("ProblemLibraryClient"));
    assert.equal(pageSource.includes("CodeforcesSearchClient"), false);
    assert.equal(pageSource.includes("evaluateCodeforcesGuard"), false);
    assert.equal(pageSource.includes("CodeforcesBulkImportClient"), false);
    assert.equal(pageSource.includes("evaluateDevProblemImportGuard"), false);
  });

  it("legacy Codeforces search card remains isolated", () => {
    assert.ok(searchSource.includes("在 Codeforces 打开"));
    assert.ok(searchSource.includes("不再导入本地库"));
    assert.equal(searchSource.includes("importCodeforcesProblemAction"), false);
    assert.equal(searchSource.includes("bulkImportCodeforcesAction"), false);
  });

  it("keeps the Codeforces problem library section", () => {
    assert.ok(pageSource.includes("ProblemLibraryClient"));
    assert.ok(pageSource.includes("Codeforces 题目列表"));
  });
});
