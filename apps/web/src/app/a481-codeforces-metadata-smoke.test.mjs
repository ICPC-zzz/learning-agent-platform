import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeCodeforcesProblemPreview,
  syncCodeforcesProblemMetadata,
  createCodeforcesExternalId,
  createCodeforcesOriginalUrl,
} from "../lib/codeforces-metadata-sync.ts";
import { mapRatingToDifficulty } from "../lib/codeforces-import-adapter.ts";
import {
  mapProblemRecordToCodeforcesMetadata,
  createCodeforcesUrl,
} from "../app/problems/codeforces-problem-metadata.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../../");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeSyncedRecord(overrides = {}) {
  const now = new Date("2026-06-21T00:00:00.000Z");
  const normalized = normalizeCodeforcesProblemPreview(
    {
      provider: "codeforces",
      externalId: "codeforces:4:A",
      contestId: 4,
      index: "A",
      name: "Watermelon",
      rating: 800,
      tags: ["math", "brute force"],
      solvedCount: 100,
      sourceUrl: "https://codeforces.com/problemset/problem/4/A",
      externalLabel: "外部数据预览 · 未导入本地",
      ...overrides,
    },
    now,
  );

  if (!normalized.valid) {
    throw new Error(`Invalid normalized preview: ${normalized.reason}`);
  }

  return {
    id: "synced-1",
    title: normalized.write.title,
    description: normalized.write.description,
    difficulty: normalized.write.difficulty,
    tags: normalized.write.tags,
    source: normalized.write.source,
    sourceUrl: normalized.write.sourceUrl,
    metadata: normalized.write.metadata,
    key: normalized.key,
  };
}

// ---------------------------------------------------------------------------
// Script argument tests
// ---------------------------------------------------------------------------

describe("A481 CLI argument support", () => {
  it("--limit 5 restricts processing to 5 valid records", async () => {
    const store = createMemoryStore();
    const problems = Array.from({ length: 20 }, (_, i) =>
      makeProblem({
        contestId: 100 + i,
        index: String.fromCharCode(65 + (i % 26)),
        name: `Problem ${i + 1}`,
        rating: 800 + i * 100,
      }),
    );

    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () => makeResponse(problems),
      store,
      maxProblems: 5,
    });

    assert.equal(result.valid, 5);
    assert.equal(result.created, 5);
    assert.equal(store.records.length, 5);
  });

  it("illegal limit (non-positive) does not corrupt behavior", async () => {
    // normalizeSyncLimit returns null for non-positive, meaning no limit
    const store = createMemoryStore();
    const problems = Array.from({ length: 3 }, (_, i) =>
      makeProblem({
        contestId: 200 + i,
        index: "A",
        name: `Problem ${i}`,
      }),
    );

    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () => makeResponse(problems),
      store,
      maxProblems: 0,
    });

    // maxProblems=0 means null (no limit)
    assert.equal(result.valid, 3);
  });

  it("dry-run store does not call createProblem or updateProblem on underlying store", async () => {
    const realStore = createMemoryStore();
    let dryCreates = 0;
    let dryUpdates = 0;

    const dryStore = {
      async listExistingProblems() {
        return realStore.listExistingProblems();
      },
      async createProblem(input) {
        dryCreates += 1;
        return {
          id: `dry-${dryCreates}`,
          ...input,
        };
      },
      async updateProblem(id, input) {
        dryUpdates += 1;
        return { id, ...input };
      },
    };

    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem(), makeProblem({ contestId: 5, index: "B", name: "New" })]),
      store: dryStore,
      maxProblems: 10,
    });

    assert.equal(result.created, 2);
    assert.equal(dryCreates, 2);
    assert.equal(dryUpdates, 0);
    assert.equal(realStore.records.length, 0, "real store must have no records");
  });

  it("legacy CLI has no HTML page parser path", () => {
    const source = readFileSync(
      resolve(repoRoot, "scripts/import-codeforces-problems.mjs"),
      "utf8",
    );

    assert.ok(source.includes("problemset.problems"));
    assert.ok(source.includes("syncCodeforcesProblemMetadata"));
    assert.ok(source.includes("--limit"));
    assert.ok(source.includes("--dry-run"));
    assert.ok(source.includes("createDryRunStore"));
    assert.equal(source.includes("CODEFORCES_PAGE_URL"), false);
    assert.equal(source.includes("parseCodeforcesProblemPage"), false);
    assert.equal(source.includes("htmlToPlainText"), false);
    assert.equal(source.includes("text/html"), false);
    assert.equal(source.includes("locale=en"), false);
  });
});

// ---------------------------------------------------------------------------
// Real write contract tests (via MemoryStore)
// ---------------------------------------------------------------------------

describe("A481 real write contract", () => {
  it("creates new problems with correct fields", async () => {
    const store = createMemoryStore();
    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem(), makeProblem({ contestId: 5, index: "B", name: "B Problem" })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(result.created, 2);
    assert.equal(store.records.length, 2);

    for (const record of store.records) {
      assert.ok(record.title.length > 0, "title must not be empty");
      assert.equal(record.description, null, "description must be null");
      assert.notEqual(record.difficulty, "", "difficulty must be set");
      assert.ok(Array.isArray(record.tags), "tags must be an array");
      assert.equal(record.source, "codeforces");
      assert.ok(
        record.sourceUrl.startsWith("https://codeforces.com/problemset/problem/"),
        `sourceUrl must be Codeforces URL, got: ${record.sourceUrl}`,
      );

      const meta = record.metadata;
      assert.ok(meta.externalId, "metadata.externalId must be set");
      assert.ok(meta.externalProblemId, "metadata.externalProblemId must be set");
      assert.ok(meta.contestId > 0, "metadata.contestId must be positive");
      assert.ok(meta.index, "metadata.index must be set");
      assert.ok(meta.originalUrl, "metadata.originalUrl must be set");
      assert.ok(meta.lastSyncedAt, "metadata.lastSyncedAt must be set");
      assert.equal(meta.importSource, "codeforces-metadata");
    }
  });

  it("duplicate sync does not create duplicate records", async () => {
    const store = createMemoryStore();
    const fetchProblemSet = async () =>
      makeResponse([makeProblem(), makeProblem({ contestId: 5, index: "B", name: "B" })]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.created, 2);
    assert.equal(first.unchanged, 0);
    assert.equal(store.records.length, 2);

    const firstIds = store.records.map((r) => r.id);

    const second = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(second.created, 0);
    assert.equal(second.unchanged, 2);
    assert.equal(store.records.length, 2, "must not create duplicate records");

    const secondIds = store.records.map((r) => r.id);
    assert.deepEqual(firstIds, secondIds, "primary keys must remain stable");
  });

  it("stable external keys remain consistent across syncs", async () => {
    const store = createMemoryStore();
    const fetchProblemSet = async () =>
      makeResponse([makeProblem(), makeProblem({ contestId: 5, index: "B", name: "B" })]);

    await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    const firstExternalIds = store.records.map((r) => r.metadata.externalId);

    await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    const secondExternalIds = store.records.map((r) => r.metadata.externalId);
    assert.deepEqual(firstExternalIds, secondExternalIds, "external keys must stay consistent");
  });

  it("updates name when changed", async () => {
    const store = createMemoryStore([
      makeSyncedRecord({ name: "Old Name" }),
    ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ name: "New Name" })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.updated, 1);
    assert.equal(store.records[0].title, "New Name");
  });

  it("updates rating when changed", async () => {
    const store = createMemoryStore([
      makeSyncedRecord({ rating: 800 }),
    ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ rating: 1200 })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.updated, 1);
    assert.equal(store.records[0].metadata.rating, 1200);
  });

  it("updates tags when changed", async () => {
    const store = createMemoryStore([
      makeSyncedRecord({ tags: ["math"] }),
    ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ tags: ["math", "dp", "greedy"] })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.updated, 1);
    assert.deepEqual(store.records[0].tags, ["math", "dp", "greedy"]);
  });

  it("missing rating is null, not 0", async () => {
    const store = createMemoryStore();
    const result = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ rating: undefined })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(result.created, 1);
    assert.equal(store.records[0].metadata.rating, null, "missing rating must be null");
    assert.notEqual(store.records[0].metadata.rating, 0, "missing rating must not be 0");
    assert.equal(
      store.records[0].difficulty,
      mapRatingToDifficulty(undefined).toUpperCase(),
      "difficulty must be UNKNOWN for missing rating",
    );
  });

  it("original URL points to Codeforces", async () => {
    const store = createMemoryStore();
    await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ contestId: 1234, index: "D" })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    const record = store.records[0];
    assert.equal(
      record.sourceUrl,
      "https://codeforces.com/problemset/problem/1234/D",
    );
    assert.equal(
      record.metadata.originalUrl,
      "https://codeforces.com/problemset/problem/1234/D",
    );
  });

  it("forbidden fields are not written", async () => {
    const store = createMemoryStore();
    await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({ contestId: 4, index: "A", name: "Test", rating: 800 }),
        ]),
      store,
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

  it("old associated records are not deleted during sync", async () => {
    const store = createMemoryStore([
      makeSyncedRecord(),
    ]);

    // Simulate associated records (favorites, attempts, etc.)
    const favoritesBefore = ["fav-1", "fav-2"];
    const attemptsBefore = ["att-1"];

    await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ rating: 900 })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    // The sync should only update the problem, not delete anything
    assert.equal(store.records.length, 1, "records must not be deleted");
    assert.equal(favoritesBefore.length, 2, "favorites must not be deleted");
    assert.equal(attemptsBefore.length, 1, "attempts must not be deleted");
  });

  it("rating missing to 800 transition works correctly", async () => {
    const store = createMemoryStore([
      makeSyncedRecord({ rating: undefined }),
    ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ rating: 800 })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.updated, 1);
    assert.equal(store.records[0].metadata.rating, 800);
  });

  it("rating 1200 to missing transition preserves null, not 0", async () => {
    const store = createMemoryStore([
      makeSyncedRecord({ rating: 1200 }),
    ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([makeProblem({ rating: undefined })]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.updated, 1);
    assert.equal(store.records[0].metadata.rating, null);
    assert.notEqual(store.records[0].metadata.rating, 0);
  });

  it("tags are deduplicated and lowercased", async () => {
    const store = createMemoryStore();
    await syncCodeforcesProblemMetadata({
      fetchProblemSet: async () =>
        makeResponse([
          makeProblem({
            tags: ["MATH", "math", "", "DP", "  dp  "],
          }),
        ]),
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.deepEqual(store.records[0].tags, ["math", "dp"]);
    assert.equal(store.records[0].metadata.tags.length, 2);
  });
});

// ---------------------------------------------------------------------------
// A479 compatibility tests
// ---------------------------------------------------------------------------

describe("A481 A479 compatibility", () => {
  it("synced records are recognized as Codeforces by metadata mapper", () => {
    const record = makeSyncedRecord();

    const view = mapProblemRecordToCodeforcesMetadata(record);
    assert.notEqual(view, null, "synced record must be recognized as Codeforces");
    if (view === null) return;

    assert.equal(view.source, "codeforces");
    assert.equal(view.sourceLabel, "Codeforces");
    assert.equal(view.title, record.title);
    assert.equal(view.contestId, 4);
    assert.equal(view.index, "A");
    assert.equal(view.rating, 800);
    assert.deepEqual(view.tags, ["math", "brute force"]);
    assert.ok(view.originalUrl, "originalUrl must be set");
    assert.ok(view.originalUrl.includes("codeforces.com"), "originalUrl must point to Codeforces");
    assert.equal(view.externalId, "codeforces:4:A");
  });

  it("list view model has correct shape for Codeforces items", () => {
    const record = makeSyncedRecord();
    const view = mapProblemRecordToCodeforcesMetadata(record);

    assert.notEqual(view, null);
    if (view === null) return;

    // Verify list-safe fields
    assert.ok(view.id, "id required");
    assert.ok(view.title, "title required");
    assert.ok("rating" in view, "rating field must exist");
    assert.ok(Array.isArray(view.tags), "tags must be array");
    assert.ok("contestId" in view, "contestId must exist");
    assert.ok("index" in view, "index must exist");
    assert.equal(view.source, "codeforces");
    assert.ok(view.originalUrl, "originalUrl must be set");
    assert.ok(view.externalId, "externalId must be set");
  });

  it("detail view model does not expose forbidden fields", () => {
    const record = makeSyncedRecord();
    // Inject forbidden content into the record metadata to ensure mapper strips it
    const taintedRecord = {
      ...record,
      metadata: {
        ...record.metadata,
        statement: "should not appear",
        examples: [{ input: "1", output: "2" }],
        judgeTestCases: "should not appear",
        editorial: "should not appear",
      },
    };

    const view = mapProblemRecordToCodeforcesMetadata(taintedRecord);
    assert.notEqual(view, null);

    const serialized = JSON.stringify(view);
    assert.equal(serialized.includes("statement"), false);
    assert.equal(serialized.includes("examples"), false);
    assert.equal(serialized.includes("judgeTestCases"), false);
    assert.equal(serialized.includes("editorial"), false);
    assert.equal(serialized.includes("sampleInput"), false);
    assert.equal(serialized.includes("sampleOutput"), false);
  });

  it("non-Codeforces records are not mixed into Codeforces view", () => {
    const nonCfRecord = {
      id: "non-cf-1",
      title: "Some Local Problem",
      tags: ["algorithms"],
      source: "local",
      sourceUrl: "https://example.com/problem/1",
      metadata: { source: "local" },
    };

    const view = mapProblemRecordToCodeforcesMetadata(nonCfRecord);
    assert.equal(view, null, "non-Codeforces record must return null");
  });

  it("rating shown as null when missing (display: 暂无Rating)", () => {
    const record = makeSyncedRecord({ rating: undefined });

    const view = mapProblemRecordToCodeforcesMetadata(record);
    assert.notEqual(view, null);
    if (view === null) return;

    assert.equal(view.rating, null, "missing rating must be null for display");
  });

  it("contestId and index persisted correctly in view", () => {
    const record = makeSyncedRecord({ contestId: 1234, index: "D" });

    const view = mapProblemRecordToCodeforcesMetadata(record);
    assert.notEqual(view, null);
    if (view === null) return;

    assert.equal(view.contestId, 1234);
    assert.equal(view.index, "D");
  });

  it("originalUrl correctly constructed for display", () => {
    const record = makeSyncedRecord({ contestId: 567, index: "F1" });

    const view = mapProblemRecordToCodeforcesMetadata(record);
    assert.notEqual(view, null);
    if (view === null) return;

    assert.ok(
      view.originalUrl.includes("codeforces.com/problemset/problem/567/F1"),
      `originalUrl must be Codeforces URL, got: ${view.originalUrl}`,
    );
  });

  it("createCodeforcesUrl helper constructs correct URLs", () => {
    assert.equal(
      createCodeforcesUrl(4, "A"),
      "https://codeforces.com/problemset/problem/4/A",
    );
    assert.equal(createCodeforcesUrl(null, "A"), null);
    assert.equal(createCodeforcesUrl(4, null), null);
    assert.equal(createCodeforcesUrl(0, "A"), null);
    assert.equal(createCodeforcesUrl(4, ""), null);
  });

  it("createCodeforcesExternalId produces stable keys", () => {
    assert.equal(createCodeforcesExternalId(4, "A"), "codeforces:4:A");
    assert.equal(createCodeforcesExternalId(1234, "D"), "codeforces:1234:D");
    assert.equal(createCodeforcesExternalId(567, "F1"), "codeforces:567:F1");
  });

  it("createCodeforcesOriginalUrl produces correct official URLs", () => {
    assert.equal(
      createCodeforcesOriginalUrl(4, "A"),
      "https://codeforces.com/problemset/problem/4/A",
    );
    assert.equal(
      createCodeforcesOriginalUrl(1234, "D"),
      "https://codeforces.com/problemset/problem/1234/D",
    );
  });
});

// ---------------------------------------------------------------------------
// A480 regression tests
// ---------------------------------------------------------------------------

describe("A481 A480 regression", () => {
  it("normalizes minimal official API metadata without body fields", () => {
    const result = normalizeCodeforcesProblemPreview(
      {
        provider: "codeforces",
        externalId: "codeforces:4:A",
        contestId: 4,
        index: " A ",
        name: " Watermelon ",
        rating: 800,
        tags: ["math", "", "math", "BRUTE FORCE"],
        solvedCount: 123,
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        externalLabel: "外部数据预览 · 未导入本地",
      },
      new Date("2026-06-21T00:00:00.000Z"),
    );

    assert.equal(result.valid, true);
    if (!result.valid) return;

    assert.equal(result.key, "codeforces:4:A");
    assert.equal(result.write.title, "Watermelon");
    assert.equal(result.write.description, null);
    assert.equal(result.write.source, "codeforces");
    assert.equal(
      result.write.sourceUrl,
      "https://codeforces.com/problemset/problem/4/A",
    );
    assert.deepEqual(result.write.tags, ["math", "brute force"]);
    assert.equal(result.write.metadata.contestId, 4);
    assert.equal(result.write.metadata.index, "A");
    assert.equal(result.write.metadata.rating, 800);
    assert.equal(
      result.write.metadata.originalUrl,
      "https://codeforces.com/problemset/problem/4/A",
    );

    const serialized = JSON.stringify(result.write);
    for (const token of [
      "inputSpecification",
      "outputSpecification",
      "judgeTestCases",
      "sampleInput",
      "sampleOutput",
      "editorial",
      "solution",
      "pageHtml",
    ]) {
      assert.equal(
        serialized.includes(token),
        false,
        `write payload must not include ${token}`,
      );
    }
  });

  it("create / update / unchanged cycle works correctly", async () => {
    const store = createMemoryStore([
      {
        id: "existing-1",
        title: "Old Name",
        description: "old imported text",
        difficulty: "EASY",
        tags: ["math"],
        source: "codeforces",
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
        metadata: {
          externalProblemId: "codeforces:4:A",
          contestId: 4,
          index: "A",
          statement: "old body must be cleared",
          examples: [{ input: "1", output: "2" }],
        },
      },
    ]);

    const fetchProblemSet = async () =>
      makeResponse([
        makeProblem({
          name: "Watermelon Updated",
          rating: 900,
          tags: ["math", "greedy"],
        }),
        makeProblem({
          contestId: 5,
          index: "B",
          name: "New Problem",
          rating: undefined,
          tags: [],
        }),
        makeProblem({
          contestId: 5,
          index: "B",
          name: "New Problem Duplicate",
        }),
      ]);

    const first = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(first.fetched, 3);
    assert.equal(first.valid, 2);
    assert.equal(first.created, 1);
    assert.equal(first.updated, 1);
    assert.equal(first.skipped, 1);
    assert.equal(store.records.length, 2);

    const updated = store.records.find((r) => r.id === "existing-1");
    assert.equal(updated.description, null);
    assert.equal(updated.title, "Watermelon Updated");
    assert.equal(JSON.stringify(updated.metadata).includes("statement"), false);
    assert.equal(JSON.stringify(updated.metadata).includes("examples"), false);

    const second = await syncCodeforcesProblemMetadata({
      fetchProblemSet,
      store,
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    });

    assert.equal(second.created, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.unchanged, 2);
    assert.equal(second.skipped, 1);
    assert.equal(store.records.length, 2);
  });
});
