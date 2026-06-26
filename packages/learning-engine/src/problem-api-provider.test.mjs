import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { createProblemApiProvider } from "./problem-api-provider.ts";

function createFakeFetch(responseData, ok = true, status = 200) {
  return async () => ({
    ok,
    status,
    json: async () => responseData,
  });
}

function createRecordingFetch(responseData) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({
      url: String(url),
      init: init
        ? {
            signal: init.signal ?? null,
            headers: init.headers ?? null,
          }
        : null,
    });
    return {
      ok: true,
      status: 200,
      json: async () => responseData,
    };
  };

  return { fetch, calls };
}

function createFakeFetchThatThrows(error) {
  return async () => {
    throw error;
  };
}

const mockProblemItem = {
  id: "prob-001",
  title: "Two Sum Preview",
  difficulty: "easy",
  tags: ["array", "hash-table"],
  summary: "Find two numbers that add up to a target.",
  sourceUrl: "https://example.com/problems/prob-001",
};

test("guard is blocked when env is missing", () => {
  const provider = createProblemApiProvider({
    env: {
      allowExternalProblemApi: false,
      problemApiBaseUrl: null,
      problemApiProvider: null,
    },
  });

  const guard = provider.getGuardStatus();
  assert.equal(guard.guardBlocked, true);
  assert.equal(guard.providerMode, "blocked");
  assert.ok(guard.missingEnvNames.length >= 2);
});

test("searchProblems returns blocked empty state when guard is blocked", async () => {
  const provider = createProblemApiProvider({
    env: {
      allowExternalProblemApi: false,
      problemApiBaseUrl: null,
      problemApiProvider: null,
    },
  });

  const result = await provider.searchProblems({ query: "two sum" });
  assert.equal(result.providerMode, "blocked");
  assert.equal(result.apiBlocked, true);
  assert.equal(result.itemsPreview.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.error, null);
  assert.equal(result.rawResponseStored, false);
  assert.equal(result.filters.page, 1);
  assert.equal(result.filters.pageSize, 10);
  assert.equal(result.paginationPreview.page, 1);
  assert.equal(result.paginationPreview.pageSize, 10);
});

test("searchProblems normalizes query and filters in the request url", async () => {
  const { fetch, calls } = createRecordingFetch({
    items: [mockProblemItem],
    totalResults: 1,
    pagination: {
      page: 1,
      pageSize: 50,
      hasNextPage: false,
    },
  });
  const provider = createProblemApiProvider({
    fetch,
    env: {
      allowExternalProblemApi: true,
      problemApiBaseUrl: "https://api.example.com",
      problemApiProvider: "generic-provider",
    },
  });

  const result = await provider.searchProblems({
    query: "  graph theory  ",
    difficulty: "hard",
    tags: [" dp ", "graph", "DP"],
    page: 0,
    pageSize: 1000,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/search?q=graph+theory&difficulty=hard&tags=dp&tags=graph&page=1&pageSize=50",
  );
  assert.equal(calls[0].init?.headers, null);
  assert.equal(result.providerMode, "external-dev");
  assert.equal(result.apiBlocked, false);
  assert.equal(result.itemsPreview.length, 1);
  assert.equal(result.query, "graph theory");
  assert.equal(result.filters.difficulty, "hard");
  assert.deepEqual(result.filters.tags, ["dp", "graph"]);
  assert.equal(result.filters.page, 1);
  assert.equal(result.filters.pageSize, 50);
  assert.equal(result.paginationPreview.page, 1);
  assert.equal(result.paginationPreview.pageSize, 50);
  assert.equal(result.paginationPreview.totalResults, 1);
  assert.equal(result.paginationPreview.totalPages, 1);
  assert.equal(result.paginationPreview.hasNextPage, false);
  assert.equal(result.paginationPreview.nextPage, null);
});

test("listProblems returns normalized preview items and pagination", async () => {
  const provider = createProblemApiProvider({
    fetch: createFakeFetch({
      problems: [mockProblemItem],
      totalResults: 12,
      pagination: {
        page: 2,
        pageSize: 5,
        hasNextPage: true,
      },
    }),
    env: {
      allowExternalProblemApi: true,
      problemApiBaseUrl: "https://api.example.com",
      problemApiProvider: "generic-provider",
    },
  });

  const result = await provider.listProblems({ page: 2, pageSize: 5 });
  assert.equal(result.providerMode, "external-dev");
  assert.equal(result.itemsPreview.length, 1);
  assert.equal(result.totalResults, 12);
  assert.equal(result.filters.page, 2);
  assert.equal(result.filters.pageSize, 5);
  assert.equal(result.paginationPreview.page, 2);
  assert.equal(result.paginationPreview.pageSize, 5);
  assert.equal(result.paginationPreview.totalPages, 3);
  assert.equal(result.paginationPreview.hasNextPage, true);
  assert.equal(result.paginationPreview.nextPage, 3);
});

test("provider errors fall back safely", async () => {
  const provider = createProblemApiProvider({
    fetch: createFakeFetchThatThrows(new Error("network timeout")),
    env: {
      allowExternalProblemApi: true,
      problemApiBaseUrl: "https://api.example.com",
      problemApiProvider: "generic-provider",
    },
  });

  const result = await provider.searchProblems({ query: "two sum" });
  assert.equal(result.providerMode, "blocked");
  assert.equal(result.apiBlocked, true);
  assert.equal(result.itemsPreview.length, 0);
  assert.ok(result.blockedReason.includes("PROVIDER_ERROR"));
  assert.equal(result.error, "Problem API request failed");
});

test("raw provider response is never exposed", async () => {
  const provider = createProblemApiProvider({
    fetch: createFakeFetch({
      items: [{ ...mockProblemItem, _internal: "secret" }],
    }),
    env: {
      allowExternalProblemApi: true,
      problemApiBaseUrl: "https://api.example.com",
      problemApiProvider: "generic-provider",
    },
  });

  const result = await provider.searchProblems({ query: "two sum" });
  const json = JSON.stringify(result);
  assert.equal(result.rawResponseStored, false);
  assert.equal(json.includes("_internal"), false);
  assert.equal(json.includes("secret"), false);
});

test("provider error fallback stays safe and strips secret-looking text", async () => {
  const provider = createProblemApiProvider({
    fetch: createFakeFetchThatThrows(new Error("Authorization: Bearer secret-123 leaked")),
    env: {
      allowExternalProblemApi: true,
      problemApiBaseUrl: "https://api.example.com",
      problemApiProvider: "generic-provider",
    },
  });

  const result = await provider.searchProblems({ query: "two sum" });
  const json = JSON.stringify(result);
  assert.equal(result.providerMode, "blocked");
  assert.equal(result.apiBlocked, true);
  assert.equal(json.includes("secret-123"), false);
  assert.equal(json.includes("Bearer"), false);
  assert.ok(result.blockedReason.includes("PROVIDER_ERROR"));
  assert.equal(result.error, "Problem API request failed");
});
