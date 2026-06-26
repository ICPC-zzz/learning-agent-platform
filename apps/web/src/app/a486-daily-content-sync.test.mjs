/**
 * A486 comprehensive tests — Daily hotspots, GitHub daily, URL normalization, and the Agent pool contract.
 *
 * This file tests the NEW capabilities added in A486.
 * Regression tests for existing blog园/CSDN/Agent pool are in their respective test files.
 */

import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// URL normalizer tests
// ---------------------------------------------------------------------------

import {
  normalizeUrlForDedup,
  buildDedupKey,
  deduplicateByKey,
} from "../lib/url-normalizer.ts";

describe("normalizeUrlForDedup", () => {
  it("removes utm_ tracking params", () => {
    const result = normalizeUrlForDedup(
      "https://example.com/page?utm_source=twitter&id=42",
    );
    expect(result).toBe("https://example.com/page?id=42");
  });

  it("removes fbclid and gclid", () => {
    const result = normalizeUrlForDedup(
      "https://example.com/page?fbclid=abc&gclid=def",
    );
    expect(result).toBe("https://example.com/page");
  });

  it("removes fragment", () => {
    const result = normalizeUrlForDedup("https://example.com/page#section-1");
    expect(result).toBe("https://example.com/page");
  });

  it("lowercases host", () => {
    const result = normalizeUrlForDedup("https://EXAMPLE.COM/Page");
    expect(result).toBe("https://example.com/Page");
  });

  it("normalizes trailing slash", () => {
    const result = normalizeUrlForDedup("https://example.com/page/");
    expect(result).toBe("https://example.com/page");
  });

  it("does not merge different pages", () => {
    const a = normalizeUrlForDedup("https://example.com/page1");
    const b = normalizeUrlForDedup("https://example.com/page2");
    expect(a).not.toBe(b);
  });

  it("returns null for empty input", () => {
    expect(normalizeUrlForDedup("")).toBeNull();
  });

  it("handles non-url input gracefully", () => {
    const result = normalizeUrlForDedup("not-a-url");
    expect(result).toBe("not-a-url");
  });
});

describe("buildDedupKey", () => {
  it("prioritizes source + externalId", () => {
    const key = buildDedupKey({
      source: "hackernews",
      externalId: "12345",
      originalUrl: "https://example.com",
    });
    expect(key).toBe("hackernews:12345");
  });

  it("falls back to URL when no source/externalId", () => {
    const key = buildDedupKey({
      source: "",
      externalId: "",
      originalUrl: "https://example.com/page",
    });
    expect(key).toBe(
      "url:https://example.com/page",
    );
  });

  it("returns null when all inputs are empty", () => {
    const key = buildDedupKey({
      source: "",
      externalId: "",
      title: "   ",
    });
    expect(key).toBeNull();
  });
});

describe("deduplicateByKey", () => {
  it("deduplicates items by key", () => {
    const items = [
      { id: "1", source: "hn", extId: "100" },
      { id: "2", source: "hn", extId: "100" }, // dup
      { id: "3", source: "hn", extId: "200" },
    ];
    const result = deduplicateByKey(items, (item) => `${item.source}:${item.extId}`);
    expect(result.size).toBe(2);
    expect(result.has("hn:100")).toBe(true);
    expect(result.has("hn:200")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hacker News provider tests
// ---------------------------------------------------------------------------

import { fetchTopStoryIds, fetchStoryDetails } from "../lib/hackernews-provider.ts";

describe("HackerNews provider", () => {
  it("fetchTopStoryIds returns array", async () => {
    const ids = await fetchTopStoryIds();
    expect(Array.isArray(ids)).toBe(true);
    // Should return at least some IDs if API is reachable
    if (ids.length === 0) {
      console.warn("HN API returned empty — API may be down, not a test failure");
    }
  });

  it("fetchStoryDetails returns item or null", async () => {
    const ids = await fetchTopStoryIds();
    if (ids.length === 0) {
      console.warn("HN API returned empty — skipping story detail test");
      return;
    }
    const item = await fetchStoryDetails(ids[0]);
    // Should be null or a valid item
    expect(item === null || typeof item.id === "number").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Forem provider tests
// ---------------------------------------------------------------------------

import { fetchForemArticles } from "../lib/forem-provider.ts";

describe("Forem provider", () => {
  it("fetchForemArticles returns array", async () => {
    const articles = await fetchForemArticles();
    expect(Array.isArray(articles)).toBe(true);
    // May be empty if API is down — that's okay
  });

  it("Forem articles have required fields when present", async () => {
    const articles = await fetchForemArticles();
    for (const article of articles) {
      expect(typeof article.externalId).toBe("string");
      expect(typeof article.title).toBe("string");
      expect(typeof article.canonicalUrl).toBe("string");
      expect(Array.isArray(article.tags)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GitHub provider tests
// ---------------------------------------------------------------------------

import {
  fetchGitHubCandidates,
  fetchLatestRelease,
} from "../lib/github-provider.ts";

describe("GitHub provider", () => {
  it("fetchGitHubCandidates returns array", async () => {
    const repos = await fetchGitHubCandidates();
    expect(Array.isArray(repos)).toBe(true);
    // May be empty if rate limited — that's okay
  });

  it("fetched repos exclude archived and forks", async () => {
    const repos = await fetchGitHubCandidates();
    for (const repo of repos) {
      expect(repo.archived).toBe(false);
      expect(repo.fork).toBe(false);
    }
  });

  it("fetchLatestRelease returns empty release on unknown repo", async () => {
    const release = await fetchLatestRelease("nonexistent/repo-12345");
    expect(release.latestReleaseTag).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sync orchestration tests (unit, no real API calls)
// ---------------------------------------------------------------------------

import {
  shouldRefreshHotspots,
  getHotspotSyncStatus,
} from "../lib/daily-tech-hotspot-sync.ts";
import {
  shouldRefreshGitHub,
  getGitHubSyncStatus,
} from "../lib/github-daily-report-sync.ts";

describe("sync cooldown", () => {
  it("shouldRefreshHotspots returns true initially", () => {
    expect(shouldRefreshHotspots(new Date())).toBe(true);
  });

  it("shouldRefreshGitHub returns true initially", () => {
    expect(shouldRefreshGitHub(new Date())).toBe(true);
  });

  it("getHotspotSyncStatus shows canRefresh=true with no prior sync", () => {
    const status = getHotspotSyncStatus(null);
    expect(status.canRefresh).toBe(true);
  });

  it("getGitHubSyncStatus shows canRefresh=true with no prior sync", () => {
    const status = getGitHubSyncStatus(null);
    expect(status.canRefresh).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Agent pool contract tests (re-verify from the node smoke test)
// ---------------------------------------------------------------------------

import {
  queryCodeforcesCandidatesForUser,
  validateUserCandidateQuery,
  getUserSolvedProblemKeys,
} from "../lib/codeforces-agent-candidates-user.ts";
import type { AgentCandidateProblemRecord } from "../lib/codeforces-agent-candidates.ts";
import type { CodeforcesAccountRepository, CodeforcesUserProblemStatRecord } from "@learning-agent-platform/db";

function buildRecord(
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
    metadata: { rating, contestId, index, solvedCount: 1000 },
    difficulty: "EASY",
  };
}

function makeKey(contestId: number, index: string): string {
  return `codeforces:${contestId}:${index}`;
}

const testRecords = [
  buildRecord("1", "A", ["dp"], 800, 1000, "A"),
  buildRecord("2", "B", ["graphs"], 1200, 1001, "B"),
  buildRecord("3", "C", ["strings"], 1500, 1002, "C"),
];

function fakeRepo(solved: string[]): CodeforcesAccountRepository {
  const stats: CodeforcesUserProblemStatRecord[] = solved.map((key, i) => ({
    id: `s${i}`,
    accountId: "a1",
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
    lastSubmissionId: i,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  return {
    async getAccountByUserId() { return { id: "a1", userId: "u1", canonicalHandle: "t", normalizedHandle: "t", currentRating: 1500, maxRating: 1600, rank: "specialist", maxRank: "expert", contribution: null, friendOfCount: null, lastOnlineAt: null, registrationAt: null, lastSubmissionAt: new Date(), lastSyncedAt: new Date(), lastSyncedSubmissionId: null, syncStatus: "idle", syncErrorCode: null, dataTruncated: false, createdAt: new Date(), updatedAt: new Date() }; },
    async getProblemStatsByAccount() { return stats; },
    async getAccountStats() { return { totalSubmissions: 10, acceptedSubmissions: 5, attemptedProblems: 8, solvedProblems: 5, unfinishedProblems: 3, lastSubmissionAt: new Date(), verdictCounts: {} }; },
    async getAccountByHandle() { return null; },
    async createAccount() { throw Error("n/a"); },
    async updateAccountSyncState() { throw Error("n/a"); },
    async deleteAccount() { throw Error("n/a"); },
    async upsertProblemStats() { return 0; },
    async getProblemStat() { return null; },
    async upsertRatingChanges() { return 0; },
    async getRatingHistory() { return []; },
    async upsertRecentSubmissions() { return 0; },
    async getRecentSubmissions() { return []; },
  };
}

describe("Agent pool contract (bun-test re-verify)", () => {
  it("excludes solved problems", async () => {
    const solved = [makeKey(1000, "A")];
    const repo = fakeRepo(solved);
    const result = await queryCodeforcesCandidatesForUser("u1", testRecords, {}, repo);
    expect(result.candidates.some((c) => c.problemKey === makeKey(1000, "A"))).toBe(false);
  });

  it("includes unsolved problems", async () => {
    const repo = fakeRepo([]);
    const result = await queryCodeforcesCandidatesForUser("u1", testRecords, {}, repo);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("reports mode and solved count", async () => {
    const repo = fakeRepo([makeKey(1000, "A")]);
    const result = await queryCodeforcesCandidatesForUser("u1", testRecords, {}, repo);
    expect(result.querySummary.mode).toBe("new_training");
    expect(result.querySummary.solvedKeysExcluded).toBe(1);
  });

  it("validateUserCandidateQuery rejects caller-set solvedProblemKeys", () => {
    const errors = validateUserCandidateQuery({ solvedProblemKeys: ["x"] } as never);
    expect(errors.some((e) => e.includes("solvedProblemKeys"))).toBe(true);
  });
});
