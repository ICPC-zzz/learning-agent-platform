import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSource(path) {
  return readFileSync(resolve(__dirname, path), "utf-8");
}

describe("A479 Codeforces problem metadata boundary", () => {
  it("defines a minimal Codeforces metadata view without old body fields", () => {
    const source = readSource("problems/codeforces-problem-metadata.ts");

    assert.ok(source.includes("CodeforcesProblemMetadataView"));
    assert.ok(source.includes('source: "codeforces"'));
    assert.ok(source.includes("rating: number | null"));
    assert.ok(source.includes("contestId: number | null"));
    assert.ok(source.includes("originalUrl: string | null"));
    assert.ok(source.includes("mapProblemRecordToCodeforcesMetadata"));
    assert.equal(source.includes("statement"), false);
    assert.equal(source.includes("judgeTestCases"), false);
    assert.equal(source.includes("sampleInput"), false);
  });

  it("public list and detail sources do not expose old problem body paths", () => {
    const targets = [
      "problems/page.tsx",
      "problems/problem-library-page-data.ts",
      "problems/problem-library-filter.ts",
    ];
    const forbidden = [
      "ProblemCodeSubmissionControl",
      "submitProblemCodeAction",
      "judgeTestCases",
      "localStorage.getItem('lap-imported-problems')",
      "PROBLEM_SOURCE_OPTIONS",
      "全部平台",
    ];

    for (const target of targets) {
      const source = readSource(target);
      for (const token of forbidden) {
        assert.equal(source.includes(token), false, `${target} must not include ${token}`);
      }
    }
  });

  it("public list source is Codeforces-only with rating filters", () => {
    const pageSource = readSource("problems/page.tsx");
    const loaderSource = readSource("problems/problem-library-page-data.ts");

    assert.ok(pageSource.includes("Codeforces Problem Center"));
    assert.ok(pageSource.includes("题目中心"));
    assert.ok(pageSource.includes("Local Codeforces Pool"));
    assert.ok(pageSource.includes('name="minRating"'));
    assert.ok(pageSource.includes('name="maxRating"'));
    assert.ok(loaderSource.includes("mapProblemRecordToCodeforcesMetadata"));
    assert.ok(loaderSource.includes("DEFAULT_CODEFORCES_CATALOG_POLICY"));
  });
});
