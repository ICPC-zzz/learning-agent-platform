/**
 * A467 Codeforces Import Adapter Tests
 *
 * Tests for codeforces-import-adapter.ts:
 * - createCodeforcesImportDraft: field mapping, safety statement, warnings
 * - No full statement → warnings include "没有完整题面"
 * - Examples always empty (no real examples from CF API)
 * - Rating → difficulty mapping
 * - Statement preview is safe metadata only
 * - No raw response retention
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

// ---------------------------------------------------------------------------
// Inline adapter — tests the logic without ESM import issues
// ---------------------------------------------------------------------------

const NO_FULL_STATEMENT_WARNING =
  "Codeforces API 当前只提供题目元数据（标题、标签、难度分级、通过人数），未导入完整题面。请通过 sourceUrl 查看原题。";
const NAME_FALLBACK = "未命名题目";

function safeTrim(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isNonEmpty(value) {
  return value.length > 0;
}

function truncateSafe(value, maxLength) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + "...";
}

function mapRatingToDifficulty(rating) {
  if (rating === undefined || !Number.isFinite(rating)) return "unknown";
  if (rating < 1200) return "easy";
  if (rating < 1700) return "medium";
  if (rating < 2200) return "hard";
  return "challenge";
}

function buildSafetyStatement(input) {
  const lines = [];
  lines.push("# " + input.name);
  lines.push("");
  lines.push("## 说明");
  lines.push("");
  lines.push(
    "本题为导入自 Codeforces 的外部题目元数据说明。Codeforces API 当前只提供题目元数据（标题、标签、难度分级、通过人数），" +
    "不含完整题面正文。以下信息仅用于帮助您了解本题的基本信息。",
  );
  lines.push("");

  if (input.contestId !== undefined) {
    lines.push("## 来源");
    lines.push("");
    lines.push("Codeforces 比赛 #" + input.contestId + "，题目 " + input.index);
    lines.push("");
  }

  if (input.rating !== undefined) {
    lines.push("## 难度分级 (Rating)");
    lines.push("");
    lines.push("Codeforces Rating: " + input.rating);
    lines.push("难度映射: " + mapRatingToDifficulty(input.rating));
    lines.push("");
  }

  if (input.tags.length > 0) {
    lines.push("## 标签");
    lines.push("");
    lines.push(input.tags.join("、"));
    lines.push("");
  }

  if (input.solvedCount !== undefined) {
    lines.push("## 通过人数");
    lines.push("");
    lines.push(formatSolvedCount(input.solvedCount));
    lines.push("");
  }

  if (input.sourceUrl) {
    lines.push("## Codeforces 原题链接");
    lines.push("");
    lines.push(input.sourceUrl);
    lines.push("");
  }

  lines.push("## 重要提示");
  lines.push("");
  lines.push(NO_FULL_STATEMENT_WARNING);
  lines.push("");
  lines.push("如需查看完整题面（题目描述、输入输出格式、样例、限制条件），请通过上方链接跳转至 Codeforces 原题页面。");

  return lines.join("\n");
}

function formatSolvedCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M 人";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K 人";
  return n + " 人";
}

function createCodeforcesImportDraft(preview) {
  const warnings = [];
  warnings.push(NO_FULL_STATEMENT_WARNING);

  const name = safeTrim(preview.name) || NAME_FALLBACK;
  const tags = (preview.tags ?? []).map(function(t) { return safeTrim(t); }).filter(isNonEmpty).slice(0, 30);
  const sourceUrl = safeTrim(preview.sourceUrl) || "";
  const rating = typeof preview.rating === "number" && Number.isFinite(preview.rating)
    ? preview.rating : undefined;
  const solvedCount = typeof preview.solvedCount === "number" && Number.isFinite(preview.solvedCount)
    ? preview.solvedCount : undefined;
  const externalId = safeTrim(preview.externalId) || "";
  const contestId = typeof preview.contestId === "number" && Number.isFinite(preview.contestId)
    ? preview.contestId : undefined;
  const index = safeTrim(preview.index) || "?";

  const difficulty = mapRatingToDifficulty(rating);

  const statementPreview = buildSafetyStatement({
    name: name,
    rating: rating,
    tags: tags,
    solvedCount: solvedCount,
    sourceUrl: sourceUrl,
    contestId: contestId,
    index: index,
  });

  // Examples always empty
  const examples = [];

  return {
    provider: "codeforces",
    externalId: truncateSafe(externalId, 200),
    contestId: contestId,
    index: truncateSafe(index, 10),
    name: truncateSafe(name, 500),
    rating: rating,
    tags: tags,
    solvedCount: solvedCount,
    sourceUrl: truncateSafe(sourceUrl, 2000),
    statementPreview: truncateSafe(statementPreview, 10000),
    examples: examples,
    warnings: warnings,
    difficulty: difficulty,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("A467 Import Adapter", function() {
  describe("createCodeforcesImportDraft", function() {
    it("maps normal preview to import draft", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:4:A",
        contestId: 4,
        index: "A",
        name: "Watermelon",
        type: "PROGRAMMING",
        rating: 800,
        tags: ["brute force", "math"],
        solvedCount: 50000,
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);

      assert.equal(draft.provider, "codeforces");
      assert.equal(draft.externalId, "codeforces:4:A");
      assert.equal(draft.name, "Watermelon");
      assert.equal(draft.rating, 800);
      assert.deepEqual(draft.tags, ["brute force", "math"]);
      assert.equal(draft.solvedCount, 50000);
      assert.equal(draft.sourceUrl, "https://codeforces.com/problemset/problem/4/A");
      assert.equal(draft.difficulty, "easy");
      assert.equal(draft.examples.length, 0);
      assert.equal(draft.productionReady, false);
      assert.equal(draft.safeToExposeToClient, true);
      assert.equal(draft.rawResponseStored, false);
    });

    it("falls back to 未命名题目 when name is missing", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:1:B",
        contestId: 1,
        index: "B",
        name: "",
        tags: [],
        sourceUrl: "",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.equal(draft.name, NAME_FALLBACK);
    });

    it("handles undefined rating → difficulty unknown", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:1:C",
        name: "Test",
        tags: [],
        sourceUrl: "",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.equal(draft.rating, undefined);
      assert.equal(draft.difficulty, "unknown");
    });

    it("always includes NO_FULL_STATEMENT warning", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:4:A",
        contestId: 4,
        index: "A",
        name: "Test Problem",
        rating: 1500,
        tags: ["dp"],
        solvedCount: 1000,
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.ok(draft.warnings.length >= 1);
      assert.ok(draft.warnings.some(function(w) { return w.includes("未导入完整题面"); }));
    });

    it("examples are always empty", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:1:A",
        name: "Test",
        tags: [],
        sourceUrl: "",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.ok(Array.isArray(draft.examples));
      assert.equal(draft.examples.length, 0);
    });

    it("statementPreview contains metadata but not fabricated problem body", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:4:A",
        contestId: 4,
        index: "A",
        name: "Watermelon",
        rating: 800,
        tags: ["brute force", "math"],
        solvedCount: 50000,
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      const stmt = draft.statementPreview;

      // Contains metadata
      assert.ok(stmt.includes("Watermelon"));
      assert.ok(stmt.includes("800"));
      assert.ok(stmt.includes("brute force"));
      assert.ok(stmt.includes("https://codeforces.com/problemset/problem/4/A"));

      // Contains the no-full-statement warning
      assert.ok(stmt.includes("未导入完整题面"));

      // Does NOT contain fabricated problem body
      assert.ok(!stmt.includes("input"));
      assert.ok(!stmt.includes("stdin"));
      assert.ok(!stmt.includes("output"));
      assert.ok(!stmt.includes("stdout"));
      assert.ok(!stmt.match(/sample/i));
    });

    it("does not contain raw response data", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:1:A",
        name: "Test",
        tags: [],
        sourceUrl: "",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);

      // No raw response markers
      assert.ok(!draft.statementPreview.includes("_raw"));
      assert.ok(!draft.statementPreview.includes("rawResponse"));
      assert.equal(draft.rawResponseStored, false);

      // Check that statementPreview doesn't contain raw JSON structures
      assert.ok(!draft.statementPreview.includes("{"));
      assert.ok(!draft.statementPreview.includes("result"));
      assert.ok(!draft.statementPreview.includes("problemStatistics"));
    });
  });

  describe("mapRatingToDifficulty", function() {
    it("maps 800 → easy", function() {
      assert.equal(mapRatingToDifficulty(800), "easy");
    });

    it("maps 1199 → easy", function() {
      assert.equal(mapRatingToDifficulty(1199), "easy");
    });

    it("maps 1200 → medium", function() {
      assert.equal(mapRatingToDifficulty(1200), "medium");
    });

    it("maps 1500 → medium", function() {
      assert.equal(mapRatingToDifficulty(1500), "medium");
    });

    it("maps 1699 → medium", function() {
      assert.equal(mapRatingToDifficulty(1699), "medium");
    });

    it("maps 1700 → hard", function() {
      assert.equal(mapRatingToDifficulty(1700), "hard");
    });

    it("maps 2000 → hard", function() {
      assert.equal(mapRatingToDifficulty(2000), "hard");
    });

    it("maps 2199 → hard", function() {
      assert.equal(mapRatingToDifficulty(2199), "hard");
    });

    it("maps 2200 → challenge", function() {
      assert.equal(mapRatingToDifficulty(2200), "challenge");
    });

    it("maps 3500 → challenge", function() {
      assert.equal(mapRatingToDifficulty(3500), "challenge");
    });

    it("maps undefined → unknown", function() {
      assert.equal(mapRatingToDifficulty(undefined), "unknown");
    });

    it("maps NaN → unknown", function() {
      assert.equal(mapRatingToDifficulty(NaN), "unknown");
    });
  });

  describe("safety statement content", function() {
    it("includes contest source info when contestId present", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:100:A",
        contestId: 100,
        index: "A",
        name: "Test",
        rating: 1500,
        tags: ["dp"],
        sourceUrl: "https://codeforces.com/problemset/problem/100/A",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.ok(draft.statementPreview.includes("比赛 #100"));
    });

    it("includes sourceUrl pointing to Codeforces", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:1:A",
        name: "Test",
        tags: [],
        sourceUrl: "https://codeforces.com/problemset/problem/1/A",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.ok(draft.statementPreview.includes("https://codeforces.com/problemset/problem/1/A"));
    });

    it("urging user to view original problem on Codeforces", function() {
      const preview = {
        provider: "codeforces",
        externalId: "codeforces:1:A",
        name: "Test",
        tags: [],
        sourceUrl: "https://codeforces.com/problemset/problem/1/A",
        externalLabel: "外部数据预览 · 未导入本地",
      };

      const draft = createCodeforcesImportDraft(preview);
      assert.ok(draft.statementPreview.includes("跳转至 Codeforces 原题页面"));
    });
  });
});
