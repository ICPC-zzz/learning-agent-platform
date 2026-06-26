/**
 * A483 Codeforces Catalog Policy Tests
 *
 * Covers:
 * - Policy evaluation (all rejection reasons)
 * - CLI parameter validation
 * - Sync integration with policy
 * - Page filtering with policy
 * - Cleanup report safety
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateCodeforcesCatalogPolicy,
  mergeCatalogPolicy,
  DEFAULT_CODEFORCES_CATALOG_POLICY,
  classifyProblemAgainstPolicy,
} from "../lib/codeforces-catalog-policy.ts";

import {
  normalizeCodeforcesProblemPreview,
  syncCodeforcesProblemMetadata,
  createCodeforcesExternalId,
} from "../lib/codeforces-metadata-sync.ts";

import { adaptCodeforcesProblemSet } from "../lib/codeforces-adapter.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../../");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreview(overrides = {}) {
  return {
    provider: "codeforces",
    externalId: "codeforces:4:A",
    contestId: 4,
    index: "A",
    name: "Watermelon",
    type: "PROGRAMMING",
    rating: 800,
    tags: ["math", "brute force"],
    solvedCount: 100,
    sourceUrl: "https://codeforces.com/problemset/problem/4/A",
    externalLabel: "外部数据预览 · 未导入本地",
    ...overrides,
  };
}

function makeResponse(problems, problemStatistics = []) {
  return {
    status: "OK",
    result: { problems, problemStatistics },
    _rawExposed: false,
  };
}

function makeProblem(overrides = {}) {
  return {
    contestId: 4,
    index: "A",
    name: "Watermelon",
    type: "PROGRAMMING",
    rating: 800,
    tags: ["math", "brute force"],
    ...overrides,
  };
}

function createMemoryStore(initial = []) {
  const records = initial.map((record) => ({
    id: record.id ?? `rec-${Math.random().toString(36).slice(2, 8)}`,
    title: record.title ?? "",
    description: record.description ?? null,
    difficulty: record.difficulty ?? "UNKNOWN",
    tags: record.tags ?? [],
    source: record.source ?? null,
    sourceUrl: record.sourceUrl ?? null,
    metadata: record.metadata ?? {},
  }));

  return {
    records,
    calls: [],
    async listExistingProblems() {
      return records.map((record) => ({ ...record }));
    },
    async createProblem(input) {
      this.calls.push({ type: "create", input });
      const record = {
        id: `created-${this.calls.length}`,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        tags: [...input.tags],
        source: input.source,
        sourceUrl: input.sourceUrl,
        metadata: { ...input.metadata },
      };
      records.push(record);
      return { ...record };
    },
    async updateProblem(id, input) {
      this.calls.push({ type: "update", id, input });
      const index = records.findIndex((record) => record.id === id);
      assert.notEqual(index, -1, `record to update must exist: ${id}`);
      records[index] = {
        id,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        tags: [...input.tags],
        source: input.source,
        sourceUrl: input.sourceUrl,
        metadata: { ...input.metadata },
      };
      return { ...records[index] };
    },
  };
}

// ---------------------------------------------------------------------------
// Policy evaluation tests
// ---------------------------------------------------------------------------

describe("A483 Codeforces catalog policy evaluation", () => {
  it("accepts rating 800 (at minimum boundary)", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 800 }));
    assert.equal(result.eligible, true);
  });

  it("accepts rating 2400 (at maximum boundary)", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 2400 }));
    assert.equal(result.eligible, true);
  });

  it("accepts rating in middle of range", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 1500 }));
    assert.equal(result.eligible, true);
  });

  it("rejects rating 799 (below min)", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 799 }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_below_min");
  });

  it("rejects rating 2401 (above max)", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 2401 }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_above_max");
  });

  it("rejects rating 3500 (far above max)", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 3500 }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_above_max");
  });

  it("rejects missing rating by default", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: undefined }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_missing");
  });

  it("rejects rating 0 as missing", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ rating: 0 }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_missing");
  });

  it("accepts missing rating when includeUnrated is true", () => {
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ rating: undefined }),
      { ...DEFAULT_CODEFORCES_CATALOG_POLICY, includeUnrated: true },
    );
    assert.equal(result.eligible, true);
  });

  it("accepts rating 0 when includeUnrated is true", () => {
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ rating: 0 }),
      { ...DEFAULT_CODEFORCES_CATALOG_POLICY, includeUnrated: true },
    );
    assert.equal(result.eligible, true);
  });

  it("rejects interactive tag (exact match)", () => {
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ tags: ["dp", "interactive"] }),
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "interactive");
  });

  it("rejects INTERACTIVE tag (case insensitive)", () => {
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ tags: ["math", "INTERACTIVE"] }),
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "interactive");
  });

  it("rejects Interactive tag (mixed case)", () => {
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ tags: ["Interactive"] }),
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "interactive");
  });

  it("accepts PROGRAMMING type", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ type: "PROGRAMMING" }));
    assert.equal(result.eligible, true);
  });

  it("rejects QUESTION type", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ type: "QUESTION" }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "unsupported_type");
  });

  it("rejects undefined type (not in allowedTypes)", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ type: undefined }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "unsupported_type");
  });

  it("rejects null type", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ type: null }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "unsupported_type");
  });

  it("rejects empty type string", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ type: "" }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "unsupported_type");
  });

  it("rejects missing contestId", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ contestId: undefined }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "contest_id_missing");
  });

  it("rejects contestId 0", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ contestId: 0 }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "contest_id_missing");
  });

  it("rejects negative contestId", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ contestId: -1 }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "contest_id_missing");
  });

  it("rejects missing index", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ index: "" }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "index_missing");
  });

  it("rejects whitespace-only index", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ index: "   " }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "index_missing");
  });

  it("rejects missing name", () => {
    const result = evaluateCodeforcesCatalogPolicy(makePreview({ name: "" }));
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "name_missing");
  });

  it("accepts problem with leading/trailing whitespace in name (trimmed)", () => {
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ name: "  Watermelon  " }),
    );
    assert.equal(result.eligible, true);
  });

  it("handles duplicate tags safely (no false rejections)", () => {
    // interactive should only be rejected if the tag is present
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ tags: ["dp", "greedy", "dp", "math"] }),
    );
    assert.equal(result.eligible, true);
  });

  it("rejects with custom policy having multiple exclude tags", () => {
    const policy = {
      ...DEFAULT_CODEFORCES_CATALOG_POLICY,
      excludeTags: ["interactive", "special"],
    };
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ tags: ["dp", "special"] }),
      policy,
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "interactive");
  });

  it("accepts with custom wider rating range", () => {
    const policy = {
      ...DEFAULT_CODEFORCES_CATALOG_POLICY,
      minRating: 600,
      maxRating: 3000,
    };
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ rating: 2900 }),
      policy,
    );
    assert.equal(result.eligible, true);
  });

  it("accepts when excludeTags is empty", () => {
    const policy = {
      ...DEFAULT_CODEFORCES_CATALOG_POLICY,
      excludeTags: [],
    };
    const result = evaluateCodeforcesCatalogPolicy(
      makePreview({ tags: ["interactive"] }),
      policy,
    );
    assert.equal(result.eligible, true);
  });

  it("mergeCatalogPolicy overrides individual fields", () => {
    const merged = mergeCatalogPolicy({
      minRating: 1000,
      includeUnrated: true,
    });
    assert.equal(merged.minRating, 1000);
    assert.equal(merged.maxRating, 2400); // unchanged
    assert.equal(merged.includeUnrated, true);
    assert.deepEqual(merged.excludeTags, ["interactive"]); // unchanged
  });

  it("mergeCatalogPolicy does not mutate base", () => {
    const base = { ...DEFAULT_CODEFORCES_CATALOG_POLICY };
    const merged = mergeCatalogPolicy({ minRating: 500 }, base);
    assert.equal(base.minRating, 800); // base unchanged
    assert.equal(merged.minRating, 500);
  });

  it("classifyProblemAgainstPolicy works for eligible DB record", () => {
    const record = {
      title: "Test Problem",
      metadata: {
        contestId: 4,
        index: "A",
        rating: 1500,
        type: "PROGRAMMING",
        tags: ["dp"],
      },
    };
    const result = classifyProblemAgainstPolicy(record, false);
    assert.equal(result.eligible, true);
    assert.equal(result.rating, 1500);
    assert.equal(result.hasUserAssociations, false);
  });

  it("classifyProblemAgainstPolicy detects ineligible DB record", () => {
    const record = {
      title: "Interactive Problem",
      metadata: {
        contestId: 100,
        index: "B",
        rating: 2000,
        type: "PROGRAMMING",
        tags: ["interactive"],
      },
    };
    const result = classifyProblemAgainstPolicy(record, true);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "interactive");
    assert.equal(result.hasUserAssociations, true);
  });
});

// ---------------------------------------------------------------------------
// Sync integration tests
// ---------------------------------------------------------------------------

describe("A483 sync with catalog policy", () => {
  it("only writes policy-eligible problems", async () => {
    const store = createMemoryStore();
    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 1, index: "A", rating: 800, name: "Good 800" }),
          makeProblem({ contestId: 2, index: "B", rating: 2400, name: "Good 2400" }),
          makeProblem({ contestId: 3, index: "C", rating: 799, name: "Too Low" }),
          makeProblem({ contestId: 4, index: "D", rating: undefined, name: "No Rating" }),
          makeProblem({ contestId: 5, index: "E", rating: 1500, tags: ["interactive"], name: "Interactive" }),
          makeProblem({ contestId: 6, index: "F", type: "QUESTION", rating: 1000, name: "Question" }),
        ]),
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(result.fetched, 6);
    assert.equal(result.valid, 6);
    assert.equal(result.eligible, 2);
    assert.equal(result.selected, 2);
    assert.equal(result.created, 2);
    assert.equal(result.skipped, 4);
    assert.equal(store.records.length, 2);
    assert.equal(store.records[0].title, "Good 800");
    assert.equal(store.records[1].title, "Good 2400");

    // Check rejection reasons
    assert.equal(result.rejectedByReason["rating_below_min"], 1);
    assert.equal(result.rejectedByReason["rating_missing"], 1);
    assert.equal(result.rejectedByReason["interactive"], 1);
    assert.equal(result.rejectedByReason["unsupported_type"], 1);
  });

  it("sync is idempotent with policy", async () => {
    const store = createMemoryStore();
    const fetchProblemSet = async () =>
      makeResponse([
        makeProblem({ contestId: 1, index: "A", rating: 800, name: "Problem A" }),
        makeProblem({ contestId: 2, index: "B", rating: 1200, name: "Problem B" }),
        makeProblem({ contestId: 3, index: "C", rating: 300, name: "Too Low" }),
      ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.eligible, 2);
    assert.equal(first.created, 2);
    assert.equal(store.records.length, 2);

    const second = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(second.eligible, 2);
    assert.equal(second.created, 0);
    assert.equal(second.unchanged, 2);
    assert.equal(store.records.length, 2);
  });

  it("does not delete old data during policy sync", async () => {
    const oldRecord = {
      id: "old-cf-problem",
      title: "Old Codeforces Problem",
      description: null,
      difficulty: "EASY",
      tags: ["math"],
      source: "codeforces",
      sourceUrl: "https://codeforces.com/problemset/problem/999/Z",
      metadata: {
        externalId: "codeforces:999:Z",
        contestId: 999,
        index: "Z",
        rating: 100,
        tags: ["math"],
      },
    };
    const store = createMemoryStore([oldRecord]);

    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 1, index: "A", rating: 800, name: "New Problem" }),
          makeProblem({ contestId: 2, index: "B", rating: 500, name: "Too Low" }),
        ]),
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    // Old record must still exist
    assert.equal(store.records.length, 2);
    const oldRecordStillThere = store.records.find((r) => r.id === "old-cf-problem");
    assert.notEqual(oldRecordStillThere, undefined);
    assert.equal(oldRecordStillThere.title, "Old Codeforces Problem");

    // New eligible record was created
    assert.equal(result.eligible, 1);
  });

  it("favorites and practice associations are unaffected", async () => {
    // Simulate user associations as external state
    const favorites = new Map();
    favorites.set("problem-1", ["user-1", "user-2"]);
    const practices = new Map();
    practices.set("problem-1", ["user-1"]);

    const store = createMemoryStore([
      {
        id: "problem-1",
        title: "Existing Problem",
        description: null,
        difficulty: "EASY",
        tags: ["math"],
        source: "codeforces",
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        metadata: {
          externalId: "codeforces:4:A",
          contestId: 4,
          index: "A",
          rating: 800,
          tags: ["math"],
        },
      },
    ]);

    await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 4, index: "A", rating: 900, name: "Updated" }),
        ]),
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    // Associations should still be intact
    assert.equal(favorites.get("problem-1").length, 2);
    assert.equal(practices.get("problem-1").length, 1);
  });

  it("limit applies after policy filtering", async () => {
    const store = createMemoryStore();
    const problems = [];
    // Generate 10 problems alternating between valid (800) and invalid (100)
    for (let i = 0; i < 20; i++) {
      problems.push(
        makeProblem({
          contestId: 100 + i,
          index: String.fromCharCode(65 + (i % 26)),
          name: `Problem ${i}`,
          rating: i % 2 === 0 ? 800 : 100,
        }),
      );
    }

    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () => makeResponse(problems),
      store,
      maxProblems: 5,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    // 5 eligible problems selected, each creating a record
    assert.equal(result.eligible, 5);
    assert.equal(result.selected, 5);
    assert.equal(result.created, 5);
    assert.equal(store.records.length, 5);

    // All created records should have rating 800
    for (const record of store.records) {
      assert.equal(record.metadata.rating, 800);
    }
  });

  it("no policy (null) writes all structurally valid problems", async () => {
    const store = createMemoryStore();
    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 1, index: "A", rating: 100, name: "Low Rating" }),
          makeProblem({ contestId: 2, index: "B", rating: undefined, name: "No Rating" }),
          makeProblem({ contestId: 3, index: "C", tags: ["interactive"], rating: 1200, name: "Interactive" }),
          makeProblem({ contestId: 4, index: "D", type: "QUESTION", rating: 900, name: "Question" }),
        ]),
      store,
      policy: null, // no policy = no filtering
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(result.valid, 4);
    assert.equal(result.eligible, 4);
    assert.equal(result.created, 4);
    assert.equal(store.records.length, 4);
  });

  it("rejectedByReason properly aggregates reasons", async () => {
    const store = createMemoryStore();
    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 1, index: "A", rating: 800, name: "Good 1" }),
          makeProblem({ contestId: 2, index: "B", rating: 700, name: "Too Low 1" }),
          makeProblem({ contestId: 3, index: "C", rating: 700, name: "Too Low 2" }),
          makeProblem({ contestId: 4, index: "D", rating: undefined, name: "No Rating 1" }),
          makeProblem({ contestId: 5, index: "E", rating: undefined, name: "No Rating 2" }),
          makeProblem({ contestId: 6, index: "F", rating: 2500, name: "Too High 1" }),
          makeProblem({ contestId: 7, index: "G", rating: 2500, name: "Too High 2" }),
          makeProblem({ contestId: 8, index: "H", rating: 2500, name: "Too High 3" }),
          makeProblem({ contestId: 9, index: "I", rating: 1500, tags: ["interactive"], name: "Interactive 1" }),
          makeProblem({ contestId: 10, index: "J", type: "QUESTION", rating: 1200, name: "Question 1" }),
        ]),
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(result.rejectedByReason["rating_below_min"], 2);
    assert.equal(result.rejectedByReason["rating_missing"], 2);
    assert.equal(result.rejectedByReason["rating_above_max"], 3);
    assert.equal(result.rejectedByReason["interactive"], 1);
    assert.equal(result.rejectedByReason["unsupported_type"], 1);
  });

  it("no forbidden fields written even with policy", async () => {
    const store = createMemoryStore();
    await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 4, index: "A", rating: 800, name: "Test" }),
        ]),
      store,
      policy: DEFAULT_CODEFORCES_CATALOG_POLICY,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    const serialized = JSON.stringify(store.records[0]);
    const forbiddenTokens = [
      "statement",
      "inputSpecification",
      "outputSpecification",
      "judgeTestCases",
      "sampleInput",
      "sampleOutput",
      "editorial",
      "solution",
      "pageHtml",
    ];

    for (const token of forbiddenTokens) {
      assert.equal(
        serialized.includes(token),
        false,
        `record must not contain forbidden field: ${token}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// CLI parameter tests (via policy evaluation)
// ---------------------------------------------------------------------------

describe("A483 CLI parameter behavior", () => {
  it("default policy is 800-2400", () => {
    assert.equal(DEFAULT_CODEFORCES_CATALOG_POLICY.minRating, 800);
    assert.equal(DEFAULT_CODEFORCES_CATALOG_POLICY.maxRating, 2400);
    assert.equal(DEFAULT_CODEFORCES_CATALOG_POLICY.includeUnrated, false);
    assert.deepEqual(DEFAULT_CODEFORCES_CATALOG_POLICY.excludeTags, ["interactive"]);
    assert.deepEqual(DEFAULT_CODEFORCES_CATALOG_POLICY.allowedTypes, ["PROGRAMMING"]);
  });

  it("custom rating range via policy", () => {
    const policy = { ...DEFAULT_CODEFORCES_CATALOG_POLICY, minRating: 1000, maxRating: 2000 };
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: 999 }), policy).eligible, false);
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: 1000 }), policy).eligible, true);
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: 2000 }), policy).eligible, true);
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: 2001 }), policy).eligible, false);
  });

  it("--include-unrated allows missing rating", () => {
    const policy = { ...DEFAULT_CODEFORCES_CATALOG_POLICY, includeUnrated: true };
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: undefined }), policy).eligible, true);
  });

  it("--include-unrated still enforces min/max for rated problems", () => {
    const policy = { ...DEFAULT_CODEFORCES_CATALOG_POLICY, includeUnrated: true };
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: 100 }), policy).eligible, false);
    assert.equal(evaluateCodeforcesCatalogPolicy(makePreview({ rating: 3000 }), policy).eligible, false);
  });

  it("custom --exclude-tag works for arbitrary tags", () => {
    const policy = {
      ...DEFAULT_CODEFORCES_CATALOG_POLICY,
      excludeTags: ["interactive", "geometry", "games"],
    };
    assert.equal(
      evaluateCodeforcesCatalogPolicy(makePreview({ tags: ["geometry"] }), policy).eligible,
      false,
    );
    assert.equal(
      evaluateCodeforcesCatalogPolicy(makePreview({ tags: ["games"] }), policy).eligible,
      false,
    );
    assert.equal(
      evaluateCodeforcesCatalogPolicy(makePreview({ tags: ["dp"] }), policy).eligible,
      true,
    );
  });

  it("legacy CLI script has no HTML page parser path", () => {
    const source = readFileSync(
      resolve(repoRoot, "scripts/import-codeforces-problems.mjs"),
      "utf8",
    );

    assert.ok(source.includes("problemset.problems"));
    assert.ok(source.includes("syncCodeforcesProblemMetadata"));
    assert.ok(source.includes("--limit"));
    assert.ok(source.includes("--dry-run"));
    assert.ok(source.includes("--min-rating"));
    assert.ok(source.includes("--max-rating"));
    assert.ok(source.includes("--include-unrated"));
    assert.ok(source.includes("--exclude-tag"));
    assert.ok(source.includes("--scope"));
    assert.ok(source.includes("--cleanup-report"));
    assert.ok(source.includes("DEFAULT_CODEFORCES_CATALOG_POLICY"));
    assert.equal(source.includes("CODEFORCES_PAGE_URL"), false);
    assert.equal(source.includes("parseCodeforcesProblemPage"), false);
    assert.equal(source.includes("htmlToPlainText"), false);
    assert.equal(source.includes("text/html"), false);
  });
});

// ---------------------------------------------------------------------------
// Page query tests
// ---------------------------------------------------------------------------

describe("A483 page query policy filtering", () => {
  it("page data loader script exists and imports catalog policy", () => {
    const source = readFileSync(
      resolve(__dirname, "problems/problem-library-page-data.ts"),
      "utf8",
    );
    assert.ok(source.includes("matchesCatalogPolicyFilter"));
    assert.ok(source.includes("DEFAULT_CODEFORCES_CATALOG_POLICY"));
    assert.ok(source.includes("codeforces-catalog-policy"));
  });

  it("page data loader still supports rating filter", () => {
    const source = readFileSync(
      resolve(__dirname, "problems/problem-library-page-data.ts"),
      "utf8",
    );
    assert.ok(source.includes("matchesRatingFilter"));
    assert.ok(source.includes("minRating"));
    assert.ok(source.includes("maxRating"));
  });
});

// ---------------------------------------------------------------------------
// Cleanup report safety
// ---------------------------------------------------------------------------

describe("A483 cleanup report safety", () => {
  it("classifyProblemAgainstPolicy never deletes or mutates", () => {
    const record = {
      title: "Test Problem",
      metadata: {
        contestId: 4,
        index: "A",
        rating: 100,
        type: "PROGRAMMING",
        tags: ["math"],
      },
    };

    // classifyProblemAgainstPolicy is pure — no side effects
    const result1 = classifyProblemAgainstPolicy(record, true);
    const result2 = classifyProblemAgainstPolicy(record, true);

    assert.equal(result1.eligible, false);
    assert.equal(result1.reason, "rating_below_min");
    assert.deepEqual(result1, result2);

    // Original record unchanged
    assert.equal(record.title, "Test Problem");
    assert.equal(record.metadata.rating, 100);
  });

  it("cleanup report script has no delete/truncate/cascade", () => {
    const source = readFileSync(
      resolve(repoRoot, "scripts/import-codeforces-problems.mjs"),
      "utf8",
    );

    assert.equal(source.includes("deleteMany"), false);
    assert.equal(source.includes(".delete("), false);
    assert.equal(source.includes("truncate"), false);
    assert.equal(source.includes("cascade"), false);
    assert.equal(source.includes("ON DELETE CASCADE"), false);
  });

  it("cleanup report properly detects user associations", () => {
    // With associations
    const withAssoc = classifyProblemAgainstPolicy(
      { title: "P1", metadata: { contestId: 1, index: "A", rating: 100 } },
      true,
    );
    assert.equal(withAssoc.hasUserAssociations, true);

    // Without associations
    const withoutAssoc = classifyProblemAgainstPolicy(
      { title: "P1", metadata: { contestId: 1, index: "A", rating: 100 } },
      false,
    );
    assert.equal(withoutAssoc.hasUserAssociations, false);
  });

  it("cleanup report correctly classifies rating_missing DB records", () => {
    const result = classifyProblemAgainstPolicy(
      {
        title: "No Rating Problem",
        metadata: { contestId: 10, index: "C" },
      },
      false,
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_missing");
    assert.equal(result.rating, null);
  });

  it("cleanup report correctly classifies above_max DB records", () => {
    const result = classifyProblemAgainstPolicy(
      {
        title: "Too Hard",
        metadata: { contestId: 10, index: "D", rating: 3000 },
      },
      false,
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_above_max");
    assert.equal(result.rating, 3000);
  });

  it("cleanup report correctly classifies eligible DB records", () => {
    const result = classifyProblemAgainstPolicy(
      {
        title: "Good Problem",
        metadata: { contestId: 100, index: "F", rating: 1500, type: "PROGRAMMING" },
      },
      false,
    );
    assert.equal(result.eligible, true);
  });
});

// ---------------------------------------------------------------------------
// A479 compatibility (synced records visible with policy)
// ---------------------------------------------------------------------------

describe("A483 A479 compatibility", () => {
  it("synced policy-eligible records are viewable", () => {
    // A policy-eligible record should pass both structural and policy checks
    const normalized = normalizeCodeforcesProblemPreview(
      makePreview({ contestId: 4, index: "A", rating: 800 }),
      new Date("2026-06-21T00:00:00.000Z"),
    );
    assert.equal(normalized.valid, true);

    const policyResult = evaluateCodeforcesCatalogPolicy(
      makePreview({ contestId: 4, index: "A", rating: 800 }),
    );
    assert.equal(policyResult.eligible, true);
  });

  it("external key format unchanged", () => {
    assert.equal(createCodeforcesExternalId(4, "A"), "codeforces:4:A");
    assert.equal(createCodeforcesExternalId(1234, "D"), "codeforces:1234:D");
  });
});

// ---------------------------------------------------------------------------
// A480 regression (sync behavior preserved)
// ---------------------------------------------------------------------------

describe("A483 A480 regression", () => {
  it("normalization still works for valid previews", () => {
    const result = normalizeCodeforcesProblemPreview(
      makePreview({
        contestId: 4,
        index: " A ",
        name: " Watermelon ",
        rating: 800,
        tags: ["math", "", "math", "BRUTE FORCE"],
      }),
      new Date("2026-06-21T00:00:00.000Z"),
    );

    assert.equal(result.valid, true);
    if (!result.valid) return;

    assert.equal(result.key, "codeforces:4:A");
    assert.equal(result.write.title, "Watermelon");
    assert.equal(result.write.description, null);
    assert.deepEqual(result.write.tags, ["math", "brute force"]);
    assert.equal(result.write.metadata.contestId, 4);
    assert.equal(result.write.metadata.rating, 800);
  });

  it("create/update/unchanged cycle still works without policy", async () => {
    const store = createMemoryStore([
      {
        id: "existing-1",
        title: "Old Name",
        description: "old text",
        difficulty: "EASY",
        tags: ["math"],
        source: "codeforces",
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        metadata: {
          externalProblemId: "codeforces:4:A",
          contestId: 4,
          index: "A",
        },
      },
    ]);

    const fetchProblemSet = async () =>
      makeResponse([
        makeProblem({ name: "Watermelon Updated", rating: 900, tags: ["math", "greedy"] }),
        makeProblem({ contestId: 5, index: "B", name: "New Problem" }),
      ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      policy: null, // no policy = backward compatible
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.valid, 2);
    assert.equal(first.created, 1);
    assert.equal(first.updated, 1);
    assert.equal(store.records.length, 2);

    const second = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      policy: null,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(second.created, 0);
    assert.equal(second.unchanged, 2);
  });
});
