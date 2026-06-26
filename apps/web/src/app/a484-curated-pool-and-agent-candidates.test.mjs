/**
 * A484 Codeforces Curated Pool & Agent Candidate Tests
 *
 * Covers:
 * - Curated pool selection (rating quotas, solvedCount sorting, deterministic)
 * - Pool config validation
 * - Tag coverage checks
 * - Agent candidate query (rating range, tags, exclusions, sorting)
 * - Agent candidate query validation
 * - A483 regression (policy compatibility)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  selectCuratedPool,
  validatePoolConfig,
  checkTagCoverage,
  resolvePreset,
  requirePreset,
  AGENT_POOL_V1_CONFIG,
  AGENT_POOL_V1_QUOTAS,
  MAX_TARGET_SIZE,
  MIN_TARGET_SIZE,
} from "../lib/codeforces-curated-pool.ts";

import {
  queryCodeforcesAgentCandidates,
  validateAgentCandidateQuery,
} from "../lib/codeforces-agent-candidates.ts";

import {
  evaluateCodeforcesCatalogPolicy,
  DEFAULT_CODEFORCES_CATALOG_POLICY,
} from "../lib/codeforces-catalog-policy.ts";

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

function makeRecord(overrides = {}) {
  return {
    id: "rec-test-1",
    title: "Watermelon",
    tags: ["math", "brute force"],
    source: "codeforces",
    sourceUrl: "https://codeforces.com/problemset/problem/4/A",
    difficulty: "EASY",
    metadata: {
      contestId: 4,
      index: "A",
      rating: 800,
      solvedCount: 100,
      tags: ["math", "brute force"],
      originalUrl: "https://codeforces.com/problemset/problem/4/A",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite 1: Curated pool selection
// ---------------------------------------------------------------------------

describe("A484 curated pool selection", () => {
  it("should select within per-rating quotas", () => {
    const eligible = [];
    // Create 200 problems at rating 800 (quota: 100)
    for (let i = 0; i < 200; i++) {
      eligible.push(makePreview({
        externalId: `codeforces:${i}:A`,
        contestId: i,
        rating: 800,
        solvedCount: 200 - i,
      }));
    }

    const result = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    assert.equal(result.selectedTotal, 100, "Should cap at quota 100 for rating 800");
    // Highest solvedCount should be first
    assert.equal(result.selected[0].solvedCount, 200, "Highest solvedCount first");
  });

  it("should handle rating bands with fewer problems than quota", () => {
    const eligible = [
      makePreview({ externalId: "codeforces:1:A", contestId: 1, rating: 2400, solvedCount: 10 }),
      makePreview({ externalId: "codeforces:2:A", contestId: 2, rating: 2400, solvedCount: 20 }),
    ];
    // Quota for 2400 is 50

    const result = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    assert.equal(result.selectedTotal, 2, "Should import all 2 when under quota");
    const band2400 = result.ratingDistribution.find((b) => b.rating === 2400);
    assert.ok(band2400, "Should have 2400 band in distribution");
    assert.equal(band2400.selected, 2);
    assert.equal(band2400.available, 2);
    assert.equal(band2400.quota, 50);
  });

  it("should not exceed targetSize", () => {
    // Create many problems that would exceed targetSize
    const eligible = [];
    for (let rating = 800; rating <= 2400; rating += 100) {
      for (let i = 0; i < 200; i++) {
        eligible.push(makePreview({
          externalId: `codeforces:${rating}:${i}`,
          contestId: rating * 100 + i,
          rating,
          solvedCount: 1000 - i,
        }));
      }
    }

    const config = { ...AGENT_POOL_V1_CONFIG, targetSize: 2000 };
    const result = selectCuratedPool(eligible, config);
    assert.ok(result.selectedTotal <= 2000, `Should not exceed targetSize 2000, got ${result.selectedTotal}`);
  });

  it("should be deterministic — same input same output", () => {
    const eligible = [];
    for (let rating = 800; rating <= 1200; rating += 100) {
      for (let i = 0; i < 50; i++) {
        eligible.push(makePreview({
          externalId: `codeforces:${rating}:${i}`,
          contestId: rating * 100 + i,
          rating,
          solvedCount: 1000 - i,
        }));
      }
    }

    const result1 = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    const result2 = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);

    assert.equal(result1.selectedTotal, result2.selectedTotal);
    for (let i = 0; i < result1.selected.length; i++) {
      assert.equal(result1.selected[i].externalId, result2.selected[i].externalId,
        `Position ${i}: ${result1.selected[i].externalId} vs ${result2.selected[i].externalId}`);
    }
  });

  it("should sort by solvedCount desc within each band", () => {
    const eligible = [
      makePreview({ externalId: "codeforces:1:A", contestId: 1, rating: 800, solvedCount: 10 }),
      makePreview({ externalId: "codeforces:2:A", contestId: 2, rating: 800, solvedCount: 100 }),
      makePreview({ externalId: "codeforces:3:A", contestId: 3, rating: 800, solvedCount: 50 }),
    ];

    const result = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    assert.equal(result.selected[0].solvedCount, 100);
    assert.equal(result.selected[1].solvedCount, 50);
    assert.equal(result.selected[2].solvedCount, 10);
  });

  it("should handle empty eligible list", () => {
    const result = selectCuratedPool([], AGENT_POOL_V1_CONFIG);
    assert.equal(result.selectedTotal, 0);
    assert.equal(result.selected.length, 0);
  });

  it("should produce ratingDistribution for all configured bands", () => {
    const eligible = [
      makePreview({ externalId: "codeforces:1:A", contestId: 1, rating: 800, solvedCount: 10 }),
    ];

    const result = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    // All 17 bands should appear in distribution
    assert.equal(result.ratingDistribution.length, AGENT_POOL_V1_QUOTAS.length);
  });

  it("should produce tag distribution", () => {
    const eligible = [
      makePreview({ externalId: "codeforces:1:A", contestId: 1, rating: 800, tags: ["math", "greedy"] }),
      makePreview({ externalId: "codeforces:2:A", contestId: 2, rating: 900, tags: ["math", "dp"] }),
    ];

    const result = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    const mathEntry = result.tagDistribution.find((e) => e.tag === "math");
    assert.ok(mathEntry, "math tag should be in distribution");
    assert.equal(mathEntry.count, 2);
  });

  it("should skip problems with undefined rating", () => {
    const eligible = [
      makePreview({ externalId: "codeforces:1:A", contestId: 1, rating: undefined }),
      makePreview({ externalId: "codeforces:2:A", contestId: 2, rating: 800, solvedCount: 10 }),
    ];

    const result = selectCuratedPool(eligible, AGENT_POOL_V1_CONFIG);
    assert.equal(result.selectedTotal, 1);
    assert.equal(result.selected[0].externalId, "codeforces:2:A");
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Pool config validation
// ---------------------------------------------------------------------------

describe("A484 pool config validation", () => {
  it("should accept valid agent-pool-v1 config", () => {
    const errors = validatePoolConfig(AGENT_POOL_V1_CONFIG);
    assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join(", ")}`);
  });

  it("should reject targetSize below minimum", () => {
    const config = { ...AGENT_POOL_V1_CONFIG, targetSize: 50 };
    const errors = validatePoolConfig(config);
    assert.ok(errors.some((e) => e.includes("targetSize")), "Should reject low targetSize");
  });

  it("should reject targetSize above maximum", () => {
    const config = { ...AGENT_POOL_V1_CONFIG, targetSize: 50000 };
    const errors = validatePoolConfig(config);
    assert.ok(errors.some((e) => e.includes("targetSize")), "Should reject high targetSize");
  });

  it("should reject duplicate rating in quotas", () => {
    const config = {
      ...AGENT_POOL_V1_CONFIG,
      quotas: [
        { rating: 800, maxProblems: 100 },
        { rating: 800, maxProblems: 50 },
      ],
    };
    const errors = validatePoolConfig(config);
    assert.ok(errors.some((e) => e.includes("Duplicate")), "Should reject duplicate rating");
  });

  it("should reject empty quotas", () => {
    const config = { ...AGENT_POOL_V1_CONFIG, quotas: [] };
    const errors = validatePoolConfig(config);
    assert.ok(errors.length > 0, "Should reject empty quotas");
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Preset resolution
// ---------------------------------------------------------------------------

describe("A484 preset resolution", () => {
  it("should resolve agent-pool-v1", () => {
    const config = resolvePreset("agent-pool-v1");
    assert.ok(config, "agent-pool-v1 should be resolvable");
    assert.equal(config.preset, "agent-pool-v1");
  });

  it("should return null for unknown preset", () => {
    assert.equal(resolvePreset("nonexistent"), null);
  });

  it("should throw for unknown preset with requirePreset", () => {
    assert.throws(() => requirePreset("nonexistent"), /Unknown preset/);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Agent candidate query — filtering
// ---------------------------------------------------------------------------

describe("A484 agent candidate query", () => {
  it("should return candidates within rating range", () => {
    const records = [
      makeRecord({ metadata: { contestId: 1, index: "A", rating: 800, solvedCount: 100 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 1500, solvedCount: 200 } }),
      makeRecord({ id: "rec-3", metadata: { contestId: 3, index: "A", rating: 2500, solvedCount: 300 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      minRating: 800,
      maxRating: 2000,
    });

    assert.equal(result.candidates.length, 2, "Should only return 800-2000 problems");
    assert.ok(result.candidates.every((c) => c.rating >= 800 && c.rating <= 2000));
  });

  it("should filter by includeTags (OR semantics)", () => {
    const records = [
      makeRecord({ id: "rec-1", tags: ["math", "greedy"], metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", tags: ["dp"], metadata: { contestId: 2, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-3", tags: ["graphs"], metadata: { contestId: 3, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      includeTags: ["math", "dp"],
    });

    assert.equal(result.candidates.length, 2, "Should return math OR dp problems");
  });

  it("should exclude solved problem keys", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      solvedProblemKeys: ["codeforces:1:A"],
    });

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].problemKey, "codeforces:2:A");
  });

  it("should exclude recently recommended keys", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      recentlyRecommendedProblemKeys: ["codeforces:1:A"],
    });

    assert.equal(result.candidates.length, 1);
  });

  it("should exclude explicitly excluded keys", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      excludeProblemKeys: ["codeforces:1:A"],
    });

    assert.equal(result.candidates.length, 1);
  });

  it("should exclude interactive problems by default", () => {
    const records = [
      makeRecord({ id: "rec-1", tags: ["interactive"], metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", tags: ["math"], metadata: { contestId: 2, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].problemKey, "codeforces:2:A");
  });

  it("should apply default limit of 30", () => {
    const records = [];
    for (let i = 0; i < 100; i++) {
      records.push(makeRecord({
        id: `rec-${i}`,
        metadata: { contestId: i, index: "A", rating: 800 + (i % 10) * 100 },
      }));
    }

    const result = queryCodeforcesAgentCandidates(records);
    assert.equal(result.candidates.length, 30, "Default limit should be 30");
  });

  it("should respect explicit limit", () => {
    const records = [];
    for (let i = 0; i < 50; i++) {
      records.push(makeRecord({
        id: `rec-${i}`,
        metadata: { contestId: i, index: "A", rating: 800 + (i % 10) * 100 },
      }));
    }

    const result = queryCodeforcesAgentCandidates(records, { limit: 5 });
    assert.equal(result.candidates.length, 5);
  });

  it("should cap limit at 100", () => {
    const records = [];
    for (let i = 0; i < 200; i++) {
      records.push(makeRecord({
        id: `rec-${i}`,
        metadata: { contestId: i, index: "A", rating: 800 + (i % 10) * 100 },
      }));
    }

    const result = queryCodeforcesAgentCandidates(records, { limit: 200 });
    assert.equal(result.candidates.length, 100, "Should cap at 100");
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Agent candidate query — sorting
// ---------------------------------------------------------------------------

describe("A484 agent candidate query sorting", () => {
  it("should sort by rating_distance", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 1500 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 1200 } }),
      makeRecord({ id: "rec-3", metadata: { contestId: 3, index: "A", rating: 1300 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      targetRating: 1250,
      sortBy: "rating_distance",
    });

    // 1200 (dist 50), 1300 (dist 50), 1500 (dist 250)
    // With secondary sort (solvedCount desc → problemKey), 1200 before 1300
    assert.equal(result.candidates[0].rating, 1200);
    assert.ok(result.candidates[0].ratingDistance !== undefined);
  });

  it("should sort by solved_count desc", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 800, solvedCount: 50 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 800, solvedCount: 200 } }),
      makeRecord({ id: "rec-3", metadata: { contestId: 3, index: "A", rating: 800, solvedCount: 100 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, { sortBy: "solved_count" });
    assert.equal(result.candidates[0].solvedCount, 200);
    assert.equal(result.candidates[1].solvedCount, 100);
    assert.equal(result.candidates[2].solvedCount, 50);
  });

  it("should sort by rating_asc", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 1500 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-3", metadata: { contestId: 3, index: "A", rating: 1200 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, { sortBy: "rating_asc" });
    assert.equal(result.candidates[0].rating, 800);
    assert.equal(result.candidates[1].rating, 1200);
    assert.equal(result.candidates[2].rating, 1500);
  });

  it("should sort by rating_desc", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", metadata: { contestId: 2, index: "A", rating: 1500 } }),
      makeRecord({ id: "rec-3", metadata: { contestId: 3, index: "A", rating: 1200 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, { sortBy: "rating_desc" });
    assert.equal(result.candidates[0].rating, 1500);
    assert.equal(result.candidates[1].rating, 1200);
    assert.equal(result.candidates[2].rating, 800);
  });

  it("should use preferredTags as secondary sort", () => {
    const records = [
      makeRecord({ id: "rec-1", tags: ["math"], metadata: { contestId: 1, index: "A", rating: 800 } }),
      makeRecord({ id: "rec-2", tags: ["dp", "math"], metadata: { contestId: 2, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records, {
      preferredTags: ["math", "dp"],
      sortBy: "rating_asc",
    });

    // Both have same rating, so preferredTags sort kicks in
    // rec-2 matches both math AND dp (2 matches), rec-1 matches only math (1 match)
    assert.equal(result.candidates[0].matchedPreferredTags.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Agent candidate query — validation
// ---------------------------------------------------------------------------

describe("A484 agent candidate query validation", () => {
  it("should reject minRating > maxRating", () => {
    const errors = validateAgentCandidateQuery({ minRating: 2000, maxRating: 1000 });
    assert.ok(errors.some((e) => e.includes("minRating")), "Should reject inverted range");
  });

  it("should reject limit > 100", () => {
    const errors = validateAgentCandidateQuery({ limit: 200 });
    assert.ok(errors.some((e) => e.includes("limit")), "Should reject high limit");
  });

  it("should accept valid query", () => {
    const errors = validateAgentCandidateQuery({
      minRating: 1000,
      maxRating: 1800,
      includeTags: ["dp", "math"],
      targetRating: 1500,
      limit: 30,
    });
    assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join(", ")}`);
  });

  it("should reject oversized solvedProblemKeys", () => {
    const huge = Array.from({ length: 6000 }, (_, i) => `codeforces:${i}:A`);
    const errors = validateAgentCandidateQuery({ solvedProblemKeys: huge });
    assert.ok(errors.some((e) => e.includes("solvedProblemKeys")), "Should reject huge keys array");
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Agent candidate — output safety
// ---------------------------------------------------------------------------

describe("A484 agent candidate output safety", () => {
  it("should not expose statement, examples, or judge fields", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 1, index: "A", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records);
    const candidate = result.candidates[0];

    // Check that forbidden keys are not in the candidate object
    const forbiddenKeys = [
      "statement",
      "examples",
      "judgeTestCases",
      "editorial",
      "solution",
      "userCode",
      "apiKey",
      "secret",
    ];

    for (const key of forbiddenKeys) {
      assert.ok(!(key in candidate), `Candidate should not have key: ${key}`);
    }
  });

  it("should always return valid problemKey format", () => {
    const records = [
      makeRecord({ id: "rec-1", metadata: { contestId: 42, index: "B2", rating: 800 } }),
    ];

    const result = queryCodeforcesAgentCandidates(records);
    assert.equal(result.candidates[0].problemKey, "codeforces:42:B2");
  });

  it("should include originalUrl", () => {
    const records = [
      makeRecord({
        id: "rec-1",
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        metadata: { contestId: 4, index: "A", rating: 800 },
      }),
    ];

    const result = queryCodeforcesAgentCandidates(records);
    assert.ok(result.candidates[0].originalUrl.includes("codeforces.com"));
  });
});

// ---------------------------------------------------------------------------
// Suite 8: A483 regression
// ---------------------------------------------------------------------------

describe("A484 A483 regression", () => {
  it("should still evaluate catalog policy correctly", () => {
    const preview = makePreview({ rating: 800, tags: ["math"] });
    const result = evaluateCodeforcesCatalogPolicy(preview);
    assert.equal(result.eligible, true);
  });

  it("should reject interactive problems via policy", () => {
    const preview = makePreview({ rating: 800, tags: ["interactive", "math"] });
    const result = evaluateCodeforcesCatalogPolicy(preview);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "interactive");
  });

  it("should reject rating below min via policy", () => {
    const preview = makePreview({ rating: 400 });
    const result = evaluateCodeforcesCatalogPolicy(preview);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "rating_below_min");
  });
});
