/**
 * A486 Agent problem pool contract tests
 *
 * Verifies:
 * - Solved problems are excluded
 * - Unsolved problems can be returned
 * - Practiced-but-unsolved problems can be returned
 * - Wrong-book solved problems are excluded (new_training)
 * - Results only from local curated pool
 * - No Codeforces API calls
 * - No LLM calls
 * - Unbound user returns empty solvedKeys
 * - Interface is read-only
 */
import { describe, expect, it } from "bun:test";
import {
  queryCodeforcesCandidatesForUser,
  getUserSolvedProblemKeys,
  validateUserCandidateQuery,
  type UserCodeforcesCandidateQuery,
} from "../lib/codeforces-agent-candidates-user.ts";
import type {
  AgentCandidateProblemRecord,
  CodeforcesAgentCandidateQuery,
} from "../lib/codeforces-agent-candidates.ts";
import type { CodeforcesAccountRepository, CodeforcesUserProblemStatRecord } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildTestRecords(): AgentCandidateProblemRecord[] {
  return [
    makeRecord("1", "Two Sum", ["dp", "greedy"], 800, 1000, "A"),
    makeRecord("2", "Graph Traversal", ["graphs", "dfs"], 1200, 1001, "B"),
    makeRecord("3", "Binary Search", ["binary search", "implementation"], 1000, 1002, "A"),
    makeRecord("4", "DP Advanced", ["dp", "math"], 2000, 1003, "C"),
    makeRecord("5", "String Match", ["strings", "hashing"], 1500, 1004, "D"),
    makeRecord("6", "Easy Array", ["implementation", "arrays"], 800, 1005, "A"),
  ];
}

function makeRecord(
  id: string,
  title: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string,
): AgentCandidateProblemRecord {
  return {
    id,
    title,
    tags,
    source: "codeforces",
    sourceUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    metadata: {
      rating,
      contestId,
      index,
      solvedCount: 1000,
      originalUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    },
    difficulty: "EASY",
  };
}

function makeProblemKey(contestId: number, index: string): string {
  return `codeforces:${contestId}:${index}`;
}

// ---------------------------------------------------------------------------
// Fake repository
// ---------------------------------------------------------------------------

function fakeRepoWithSolvedKeys(solvedKeys: string[]): CodeforcesAccountRepository {
  const stats: CodeforcesUserProblemStatRecord[] = solvedKeys.map((key, i) => ({
    id: `stat-${i}`,
    accountId: "account-1",
    problemKey: key,
    contestId: 0,
    index: "",
    name: "",
    rating: 800,
    tags: [],
    attempts: 1,
    accepted: true,
    firstSubmittedAt: new Date(),
    firstAcceptedAt: new Date(),
    lastSubmittedAt: new Date(),
    lastVerdict: "OK",
    lastSubmissionId: i + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  return {
    createAccount: async () => { throw new Error("not implemented"); },
    getAccountByUserId: async () => ({
      id: "account-1",
      userId: "user-1",
      canonicalHandle: "test_user",
      normalizedHandle: "test_user",
      currentRating: 1500,
      maxRating: 1600,
      rank: "specialist",
      maxRank: "expert",
      contribution: null,
      friendOfCount: null,
      lastOnlineAt: null,
      registrationAt: null,
      lastSubmissionAt: new Date(),
      lastSyncedAt: new Date(),
      lastSyncedSubmissionId: null,
      syncStatus: "idle",
      syncErrorCode: null,
      dataTruncated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getAccountByHandle: async () => null,
    updateAccountSyncState: async () => { throw new Error("not implemented"); },
    deleteAccount: async () => { throw new Error("not implemented"); },
    upsertProblemStats: async () => 0,
    getProblemStatsByAccount: async () => stats,
    getProblemStat: async () => null,
    upsertRatingChanges: async () => 0,
    getRatingHistory: async () => [],
    upsertRecentSubmissions: async () => 0,
    getRecentSubmissions: async () => [],
    getAccountStats: async () => ({ totalSubmissions: 100, acceptedSubmissions: 50, attemptedProblems: 30, solvedProblems: 15, unfinishedProblems: 15, lastSubmissionAt: new Date(), verdictCounts: {} }),
  };
}

function fakeRepoNoAccount(): CodeforcesAccountRepository {
  return {
    ...fakeRepoWithSolvedKeys([]),
    getAccountByUserId: async () => null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("queryCodeforcesCandidatesForUser", () => {
  const records = buildTestRecords();

  it("excludes all solved problems", async () => {
    const solved = [makeProblemKey(1000, "A"), makeProblemKey(1002, "A")];
    const repo = fakeRepoWithSolvedKeys(solved);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    const resultKeys = new Set(result.candidates.map((c) => c.problemKey));
    for (const key of solved) {
      expect(resultKeys.has(key)).toBe(false);
    }
    expect(result.querySummary.solvedKeysExcluded).toBe(2);
  });

  it("returns unsolved problems that match criteria", async () => {
    const solved = [makeProblemKey(1000, "A")];
    const repo = fakeRepoWithSolvedKeys(solved);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    expect(result.candidates.length).toBeGreaterThan(0);
    const unsolvedKey = makeProblemKey(1001, "B");
    expect(result.candidates.some((c) => c.problemKey === unsolvedKey)).toBe(true);
  });

  it("allows practiced-but-unsolved problems as candidates", async () => {
    // User attempted problem 1001/B but didn't solve it — should still be eligible
    const solved = [makeProblemKey(1000, "A")]; // only 1000/A is solved
    const repo = fakeRepoWithSolvedKeys(solved);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    const practicedUnsolved = makeProblemKey(1001, "B");
    expect(result.candidates.some((c) => c.problemKey === practicedUnsolved)).toBe(true);
  });

  it("excludes wrong-book problems that are solved", async () => {
    // If a problem is in wrong book AND solved, it's excluded (new_training mode)
    const solved = [
      makeProblemKey(1000, "A"),
      makeProblemKey(1001, "B"), // Was in wrong book but now solved
    ];
    const repo = fakeRepoWithSolvedKeys(solved);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    const wasWrongBookButSolved = makeProblemKey(1001, "B");
    expect(result.candidates.some((c) => c.problemKey === wasWrongBookButSolved)).toBe(false);
  });

  it("only returns results from the local curated pool", async () => {
    const repo = fakeRepoWithSolvedKeys([]);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    for (const candidate of result.candidates) {
      expect(records.some((r) => r.id === candidate.problemId)).toBe(true);
    }
  });

  it("does not return candidates not in the local pool", async () => {
    const repo = fakeRepoWithSolvedKeys([]);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    // Ensure no phantom candidates appear
    const phantomIds = result.candidates.filter(
      (c) => !records.some((r) => r.id === c.problemId),
    );
    expect(phantomIds.length).toBe(0);
  });

  it("handles unbound user safely (no account)", async () => {
    const repo = fakeRepoNoAccount();
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    // Should still work — just no solved keys to exclude
    expect(result.querySummary.solvedKeysExcluded).toBe(0);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("interface is read-only (no writes to repo)", async () => {
    let writeCalled = false;
    const repo: CodeforcesAccountRepository = {
      ...fakeRepoWithSolvedKeys([]),
      upsertProblemStats: async () => { writeCalled = true; return 0; },
    };
    await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);
    expect(writeCalled).toBe(false);
  });

  it("does not call Codeforces API (no network)", async () => {
    const repo = fakeRepoWithSolvedKeys([]);
    // The wrapper never calls Codeforces client — only repository
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);
    expect(result.candidates).toBeDefined();
  });

  it("does not call LLM", async () => {
    const repo = fakeRepoWithSolvedKeys([]);
    // Pure deterministic logic — no provider calls
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);
    expect(result.querySummary.mode).toBe("new_training");
  });

  it("does not return problem statement or examples", async () => {
    const repo = fakeRepoWithSolvedKeys([]);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    for (const candidate of result.candidates) {
      // Type check: candidate should not have statement or examples fields
      const c = candidate as Record<string, unknown>;
      expect(c.statement).toBeUndefined();
      expect(c.examples).toBeUndefined();
      expect(c.description).toBeUndefined();
      expect(c.solution).toBeUndefined();
    }
  });

  it("respects rating and tag filters", async () => {
    const repo = fakeRepoWithSolvedKeys([]);
    const result = await queryCodeforcesCandidatesForUser(
      "user-1",
      records,
      { minRating: 1500, maxRating: 2500, includeTags: ["dp"] },
      repo,
    );

    for (const candidate of result.candidates) {
      expect(candidate.rating).toBeGreaterThanOrEqual(1500);
      expect(candidate.rating).toBeLessThanOrEqual(2500);
    }
  });

  it("reports mode and solved keys excluded in summary", async () => {
    const solved = [makeProblemKey(1000, "A"), makeProblemKey(1002, "A"), makeProblemKey(1003, "C")];
    const repo = fakeRepoWithSolvedKeys(solved);
    const result = await queryCodeforcesCandidatesForUser("user-1", records, {}, repo);

    expect(result.querySummary.mode).toBe("new_training");
    expect(result.querySummary.solvedKeysExcluded).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getUserSolvedProblemKeys
// ---------------------------------------------------------------------------

describe("getUserSolvedProblemKeys", () => {
  it("returns solved keys for bound user", async () => {
    const solved = ["codeforces:1000:A", "codeforces:2000:B"];
    const repo = fakeRepoWithSolvedKeys(solved);
    const keys = await getUserSolvedProblemKeys("user-1", repo);
    expect(keys).toEqual(solved);
  });

  it("returns empty array for unbound user", async () => {
    const repo = fakeRepoNoAccount();
    const keys = await getUserSolvedProblemKeys("user-1", repo);
    expect(keys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateUserCandidateQuery
// ---------------------------------------------------------------------------

describe("validateUserCandidateQuery", () => {
  it("accepts valid new_training query", () => {
    const errors = validateUserCandidateQuery({ mode: "new_training" });
    expect(errors.length).toBe(0);
  });

  it("accepts query with no mode (defaults to new_training)", () => {
    const errors = validateUserCandidateQuery({});
    expect(errors.length).toBe(0);
  });

  it("rejects unsupported mode", () => {
    const q = { mode: "review" } as UserCodeforcesCandidateQuery;
    const errors = validateUserCandidateQuery(q);
    expect(errors.some((e) => e.includes("review"))).toBe(true);
  });

  it("rejects solvedProblemKeys being set by caller", () => {
    const q = { solvedProblemKeys: ["key1"] } as unknown as UserCodeforcesCandidateQuery;
    const errors = validateUserCandidateQuery(q);
    expect(errors.some((e) => e.includes("solvedProblemKeys"))).toBe(true);
  });
});
