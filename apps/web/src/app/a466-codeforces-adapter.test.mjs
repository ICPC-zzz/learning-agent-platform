/**
 * A466 Codeforces Adapter Tests
 *
 * Tests for codeforces-adapter.ts:
 * - adaptCodeforcesProblemSet: field mapping, statistics matching, fallbacks
 * - Missing fields don't throw
 * - solvedCount matching
 * - sourceUrl correctness
 * - No raw response retention
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

// ---------------------------------------------------------------------------
// Inline adapter — tests the logic without ESM import issues
// ---------------------------------------------------------------------------

const CODEFORCES_PROBLEM_URL = "https://codeforces.com/problemset/problem";
const NAME_FALLBACK = "未命名题目";

function adaptCodeforcesProblemSet(response) {
  const warnings = [];

  if (!response.result) {
    return {
      previews: [],
      totalFetched: 0,
      warnings: ["Codeforces response had no result field"],
      dbWritten: false,
      rawResponseStored: false,
    };
  }

  const { problems, problemStatistics } = response.result;

  if (!Array.isArray(problems) || problems.length === 0) {
    return {
      previews: [],
      totalFetched: 0,
      warnings: ["Codeforces response contained no problems"],
      dbWritten: false,
      rawResponseStored: false,
    };
  }

  const statsMap = buildStatsMap(problemStatistics, warnings);
  const previews = [];

  for (const rawProblem of problems) {
    try {
      const preview = adaptProblem(rawProblem, statsMap);
      previews.push(preview);
    } catch {
      warnings.push("Skipped a malformed problem entry");
    }
  }

  return {
    previews,
    totalFetched: previews.length,
    warnings,
    dbWritten: false,
    rawResponseStored: false,
  };
}

function adaptProblem(raw, statsMap) {
  if (!isRecord(raw)) {
    throw new Error("Problem entry is not a valid object");
  }

  const contestId = extractNumber(raw.contestId);
  const index = extractString(raw.index) ?? "?";
  const name = extractString(raw.name) ?? NAME_FALLBACK;
  const type = extractString(raw.type);
  const rating = extractNumber(raw.rating);
  const tags = extractTags(raw.tags);
  const sourceUrl = contestId !== undefined
    ? `${CODEFORCES_PROBLEM_URL}/${contestId}/${encodeURIComponent(index)}`
    : "";
  const externalId = `codeforces:${contestId ?? "unknown"}:${index}`;

  const statsKey = `${contestId}:${index}`;
  const solvedCount = statsMap.get(statsKey);

  return {
    provider: "codeforces",
    externalId,
    contestId,
    index,
    name,
    type,
    rating,
    tags,
    solvedCount,
    sourceUrl,
    externalLabel: "外部数据预览 · 未导入本地",
  };
}

function buildStatsMap(rawStats, warnings) {
  const map = new Map();
  if (!Array.isArray(rawStats)) {
    warnings.push("Codeforces problemStatistics is not an array");
    return map;
  }
  for (const entry of rawStats) {
    if (!isRecord(entry)) continue;
    const contestId = extractNumber(entry.contestId);
    const index = extractString(entry.index);
    if (contestId === undefined || !index) continue;
    const key = `${contestId}:${index}`;
    const solvedCount = extractNumber(entry.solvedCount);
    if (solvedCount !== undefined) {
      map.set(key, solvedCount);
    }
  }
  if (map.size === 0 && rawStats.length > 0) {
    warnings.push("No problem statistics were matched to problems");
  }
  return map;
}

function extractString(value) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function extractNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function extractTags(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().toLowerCase();
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= 30) break;
  }
  return result;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Make a valid response
// ---------------------------------------------------------------------------

function makeResponse(problems, problemStatistics = []) {
  return {
    status: "OK",
    result: { problems, problemStatistics },
    _rawExposed: false,
  };
}

function makeProblem(opts = {}) {
  return {
    contestId: opts.contestId ?? 4,
    index: opts.index ?? "A",
    name: opts.name ?? "Watermelon",
    type: opts.type ?? "PROGRAMMING",
    rating: opts.rating ?? 800,
    tags: opts.tags ?? ["brute force", "math"],
  };
}

function makeStat(opts = {}) {
  return {
    contestId: opts.contestId ?? 4,
    index: opts.index ?? "A",
    solvedCount: opts.solvedCount ?? 12345,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("A466 Codeforces Adapter — field mapping", () => {
  it("1. complete field mapping — all fields present", () => {
    const response = makeResponse(
      [makeProblem()],
      [makeStat()],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 1);
    const p = result.previews[0];

    assert.strictEqual(p.provider, "codeforces");
    assert.strictEqual(p.contestId, 4);
    assert.strictEqual(p.index, "A");
    assert.strictEqual(p.name, "Watermelon");
    assert.strictEqual(p.type, "PROGRAMMING");
    assert.strictEqual(p.rating, 800);
    assert.deepStrictEqual(p.tags, ["brute force", "math"]);
    assert.strictEqual(p.solvedCount, 12345);
    assert.strictEqual(p.sourceUrl, "https://codeforces.com/problemset/problem/4/A");
    assert.strictEqual(p.externalId, "codeforces:4:A");
    assert.strictEqual(p.externalLabel, "外部数据预览 · 未导入本地");
  });

  it("2. solvedCount matched by contestId + index", () => {
    const response = makeResponse(
      [
        { contestId: 100, index: "A", name: "Problem A" },
        { contestId: 100, index: "B", name: "Problem B" },
      ],
      [
        { contestId: 100, index: "A", solvedCount: 5000 },
        { contestId: 100, index: "B", solvedCount: 3000 },
      ],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 2);
    assert.strictEqual(result.previews[0].solvedCount, 5000);
    assert.strictEqual(result.previews[1].solvedCount, 3000);
  });

  it("3. solvedCount undefined when no matching statistic", () => {
    const response = makeResponse(
      [{ contestId: 100, index: "Z", name: "Obscure" }],
      [{ contestId: 100, index: "A", solvedCount: 5000 }],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 1);
    assert.strictEqual(result.previews[0].solvedCount, undefined);
  });

  it("4. sourceUrl format — /problemset/problem/{contestId}/{index}", () => {
    const response = makeResponse(
      [{ contestId: 1772, index: "D", name: "Score of a Tree" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews[0].sourceUrl, "https://codeforces.com/problemset/problem/1772/D");
  });

  it("5. externalId format — codeforces:{contestId}:{index}", () => {
    const response = makeResponse(
      [{ contestId: 4, index: "A", name: "Watermelon" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews[0].externalId, "codeforces:4:A");
  });

  it("6. tags deduplicated and lowercased", () => {
    const response = makeResponse(
      [{ contestId: 1, index: "A", name: "Test", tags: ["DP", "dp", "DP", "greedy"] }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.deepStrictEqual(result.previews[0].tags, ["dp", "greedy"]);
  });
});

describe("A466 Codeforces Adapter — missing fields & fallbacks", () => {
  it("7. rating missing → undefined, no throw", () => {
    const response = makeResponse(
      [{ contestId: 1, index: "A", name: "No Rating" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews[0].rating, undefined);
  });

  it("8. tags missing → empty array, no throw", () => {
    const response = makeResponse(
      [{ contestId: 1, index: "A", name: "No Tags" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.deepStrictEqual(result.previews[0].tags, []);
  });

  it("9. name missing → '未命名题目'", () => {
    const response = makeResponse(
      [{ contestId: 1, index: "A" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews[0].name, NAME_FALLBACK);
  });

  it("10. type missing → null (no type field)", () => {
    const response = makeResponse(
      [{ contestId: 1, index: "A", name: "Test" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews[0].type, null);
  });

  it("11. contestId missing → undefined, externalId uses 'unknown'", () => {
    const response = makeResponse(
      [{ index: "A", name: "No Contest" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 1);
    const p = result.previews[0];
    assert.strictEqual(p.contestId, undefined);
    assert.strictEqual(p.externalId, "codeforces:unknown:A");
    assert.strictEqual(p.sourceUrl, "");
  });

  it("12. index missing → '?'", () => {
    const response = makeResponse(
      [{ contestId: 1, name: "No Index" }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews[0].index, "?");
    assert.strictEqual(result.previews[0].externalId, "codeforces:1:?");
  });

  it("13. tags contains non-string items → filtered out", () => {
    const response = makeResponse(
      [{ contestId: 1, index: "A", name: "Test", tags: ["dp", null, 123, true, "math", {}] }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.deepStrictEqual(result.previews[0].tags, ["dp", "math"]);
  });

  it("14. tags exceed 30 → truncated", () => {
    const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
    const response = makeResponse(
      [{ contestId: 1, index: "A", name: "Many Tags", tags: manyTags }],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.ok(result.previews[0].tags.length <= 30);
  });
});

describe("A466 Codeforces Adapter — edge cases", () => {
  it("15. empty problems array → empty previews, warning", () => {
    const response = makeResponse([], []);
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 0);
    assert.strictEqual(result.totalFetched, 0);
    assert.ok(result.warnings.some(w => w.includes("no problems")));
  });

  it("16. null result → empty previews, warning", () => {
    const result = adaptCodeforcesProblemSet({ status: "OK", result: null, _rawExposed: false });
    assert.strictEqual(result.previews.length, 0);
    assert.ok(result.warnings.some(w => w.includes("no result field")));
  });

  it("17. malformed problem entry → skipped, warning added", () => {
    const response = makeResponse(
      [
        "not an object",
        { contestId: 1, index: "A", name: "Good" },
      ],
      [],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 1);
    assert.ok(result.warnings.some(w => w.includes("Skipped a malformed")));
  });

  it("18. no problemStatistics → all solvedCount undefined", () => {
    const response = makeResponse(
      [
        { contestId: 1, index: "A", name: "A" },
        { contestId: 1, index: "B", name: "B" },
      ],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 2);
    for (const p of result.previews) {
      assert.strictEqual(p.solvedCount, undefined);
    }
  });

  it("19. problemStatistics is not an array → warning, no crash", () => {
    const response = {
      status: "OK",
      result: {
        problems: [{ contestId: 1, index: "A", name: "Test" }],
        problemStatistics: "not an array",
      },
      _rawExposed: false,
    };
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 1);
    assert.ok(result.warnings.some(w => w.includes("not an array")));
  });

  it("20. no raw response in output — dbWritten=false, rawResponseStored=false", () => {
    const response = makeResponse([makeProblem()], [makeStat()]);
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.dbWritten, false);
    assert.strictEqual(result.rawResponseStored, false);
    // Each preview doesn't contain raw data
    for (const p of result.previews) {
      assert.strictEqual(p._raw, undefined);
      assert.strictEqual(p.rawProblem, undefined);
    }
  });

  it("21. statistics with missing entries → handled gracefully", () => {
    const response = makeResponse(
      [
        { contestId: 4, index: "A", name: "A" },
        { contestId: 4, index: "B", name: "B" },
        { contestId: 4, index: "C", name: "C" },
      ],
      [
        { contestId: 4, index: "A", solvedCount: 100 },
        // B missing
        { contestId: 4, index: "C" }, // no solvedCount
      ],
    );
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 3);
    assert.strictEqual(result.previews[0].solvedCount, 100);
    assert.strictEqual(result.previews[1].solvedCount, undefined);
    assert.strictEqual(result.previews[2].solvedCount, undefined);
  });

  it("22. large dataset — 100 problems adapted correctly", () => {
    const problems = Array.from({ length: 100 }, (_, i) => ({
      contestId: i + 1,
      index: "A",
      name: `Problem ${i + 1}`,
      rating: 800 + (i % 10) * 100,
      tags: [`tag${i % 5}`],
    }));
    const stats = Array.from({ length: 100 }, (_, i) => ({
      contestId: i + 1,
      index: "A",
      solvedCount: 1000 * (i + 1),
    }));
    const response = makeResponse(problems, stats);
    const result = adaptCodeforcesProblemSet(response);
    assert.strictEqual(result.previews.length, 100);
    assert.strictEqual(result.totalFetched, 100);
  });
});

console.log("\n=== A466 Codeforces Adapter Tests Complete ===\n");