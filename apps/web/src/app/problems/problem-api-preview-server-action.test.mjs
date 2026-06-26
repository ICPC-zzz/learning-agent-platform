import assert from "node:assert/strict";
import test from "node:test";

const MOD_URL = new URL("./problem-api-preview-server-action.ts", import.meta.url).href;
const { previewProblemApiAction } = await import(MOD_URL);
const NORMALIZE_URL = new URL("./problem-api-preview-request.ts", import.meta.url).href;
const { normalizeProblemApiPreviewRequest } = await import(NORMALIZE_URL);

const PROBLEM_ENV_KEYS = [
  "NODE_ENV",
  "LAP_ALLOW_EXTERNAL_PROBLEM_API",
  "LAP_PROBLEM_API_BASE_URL",
  "LAP_PROBLEM_API_PROVIDER",
];

async function withProblemEnv(env, fn) {
  const previous = new Map(PROBLEM_ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of PROBLEM_ENV_KEYS) {
      if (Object.prototype.hasOwnProperty.call(env, key)) {
        const value = env[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      } else if (previous.get(key) === undefined) {
        delete process.env[key];
      }
    }

    return await fn();
  } finally {
    for (const key of PROBLEM_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withFetch(fetchImpl, fn) {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = fetchImpl;
    return await fn();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("problem API preview stays blocked when env is missing", async () => {
  const result = await withProblemEnv(
    {
      NODE_ENV: "development",
      LAP_ALLOW_EXTERNAL_PROBLEM_API: undefined,
      LAP_PROBLEM_API_BASE_URL: undefined,
      LAP_PROBLEM_API_PROVIDER: undefined,
    },
    () => previewProblemApiAction({ query: "  two sum  " }),
  );

  assert.equal(result.providerMode, "blocked");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.rawResponseStored, false);
  assert.equal(result.externalApiQueried, false);
  assert.equal(result.apiBlocked, true);
  assert.equal(result.query, "two sum");
  assert.equal(result.filters.page, 1);
  assert.equal(result.filters.pageSize, 10);
  assert.equal(result.paginationPreview.page, 1);
  assert.equal(result.paginationPreview.pageSize, 10);
  assert.equal(result.error, null);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"));
  assert.ok(result.missingEnvNames.includes("LAP_PROBLEM_API_BASE_URL"));
  assert.ok(result.missingEnvNames.includes("LAP_PROBLEM_API_PROVIDER"));
});

test("problem API preview normalizes query, difficulty, tags, and pagination", () => {
  const normalized = normalizeProblemApiPreviewRequest({
    query: "  graph theory  ",
    difficulty: "HARD",
    tags: [" dp ", "graph", "DP"],
    page: 0,
    pageSize: 500,
    language: " en ",
  });

  assert.equal(normalized.query, "graph theory");
  assert.equal(normalized.difficulty, "hard");
  assert.deepEqual(normalized.tags, ["dp", "graph"]);
  assert.equal(normalized.page, 1);
  assert.equal(normalized.pageSize, 50);
  assert.equal(normalized.language, "en");
});

test("problem API preview returns external-dev search results with pagination preview", async () => {
  const result = await withProblemEnv(
    {
      NODE_ENV: "development",
      LAP_ALLOW_EXTERNAL_PROBLEM_API: "1",
      LAP_PROBLEM_API_BASE_URL: "https://api.example.com",
      LAP_PROBLEM_API_PROVIDER: "generic-provider",
    },
    () =>
      withFetch(
        async (_url, _init) => ({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "p-001",
                title: "Preview Two Sum",
                difficulty: "easy",
                tags: ["array", "hash-table"],
                summary: "Find two numbers that add up to a target.",
                url: "https://example.com/problems/p-001",
              },
            ],
            totalResults: 12,
            pagination: {
              page: 2,
              pageSize: 5,
              hasNextPage: true,
            },
          }),
        }),
        () =>
          previewProblemApiAction({
            query: "two sum",
            difficulty: "easy",
            tags: ["array", "hash-table"],
            page: 2,
            pageSize: 5,
          }),
      ),
  );

  assert.equal(result.providerMode, "external-dev");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.rawResponseStored, false);
  assert.equal(result.externalApiQueried, true);
  assert.equal(result.sourceMode, "search");
  assert.equal(result.apiBlocked, false);
  assert.equal(result.query, "two sum");
  assert.equal(result.filters.difficulty, "easy");
  assert.deepEqual(result.filters.tags, ["array", "hash-table"]);
  assert.equal(result.paginationPreview.page, 2);
  assert.equal(result.paginationPreview.pageSize, 5);
  assert.equal(result.paginationPreview.totalResults, 12);
  assert.equal(result.paginationPreview.totalPages, 3);
  assert.equal(result.paginationPreview.hasNextPage, true);
  assert.equal(result.paginationPreview.nextPage, 3);
  assert.equal(result.itemsPreview.length, 1);
  assert.equal(result.itemsPreview[0].externalProblemId, "p-001");
  assert.equal(result.itemsPreview[0].title, "Preview Two Sum");
  assert.equal(result.missingEnvNames.length, 0);
  assert.equal(result.blockedReason, null);
  assert.equal(result.error, null);
});

test("problem API list preview uses the list source mode and keeps pagination safe", async () => {
  const result = await withProblemEnv(
    {
      NODE_ENV: "development",
      LAP_ALLOW_EXTERNAL_PROBLEM_API: "true",
      LAP_PROBLEM_API_BASE_URL: "https://api.example.com",
      LAP_PROBLEM_API_PROVIDER: "generic-provider",
    },
    () =>
      withFetch(
        async (_url, _init) => ({
          ok: true,
          status: 200,
          json: async () => ({
            problems: [
              {
                id: "p-101",
                title: "Breadth First Search",
                difficulty: "medium",
                tags: ["graph", "bfs"],
                summary: "Visit nodes level by level.",
                sourceUrl: "https://example.com/problems/p-101",
              },
            ],
            totalResults: 1,
          }),
        }),
        () =>
          previewProblemApiAction({
            page: 1,
            pageSize: 10,
          }),
      ),
  );

  assert.equal(result.sourceMode, "list");
  assert.equal(result.providerMode, "external-dev");
  assert.equal(result.externalApiQueried, true);
  assert.equal(result.query, "");
  assert.equal(result.paginationPreview.page, 1);
  assert.equal(result.paginationPreview.pageSize, 10);
  assert.equal(result.paginationPreview.totalPages, 1);
  assert.equal(result.itemsPreview.length, 1);
});

test("problem API preview hides secret-like error text on failure", async () => {
  const result = await withProblemEnv(
    {
      NODE_ENV: "development",
      LAP_ALLOW_EXTERNAL_PROBLEM_API: "true",
      LAP_PROBLEM_API_BASE_URL: "https://api.example.com",
      LAP_PROBLEM_API_PROVIDER: "generic-provider",
    },
    () =>
      withFetch(
        async () => {
          throw new Error("Authorization: Bearer secret-123 leaked");
        },
        () => previewProblemApiAction({ query: "two sum" }),
      ),
  );

  const json = JSON.stringify(result);
  assert.equal(result.providerMode, "blocked");
  assert.equal(result.apiBlocked, true);
  assert.equal(result.externalApiQueried, true);
  assert.equal(result.itemsPreview.length, 0);
  assert.equal(result.error, "Problem API request failed");
  assert.equal(json.includes("secret-123"), false);
  assert.equal(json.includes("Bearer"), false);
  assert.ok(result.blockedReason.includes("PROVIDER_ERROR"));
});
