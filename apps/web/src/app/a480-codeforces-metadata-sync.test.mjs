import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeCodeforcesProblemPreview,
  syncCodeforcesProblemMetadata,
} from "../lib/codeforces-metadata-sync.ts";
import { adaptCodeforcesProblemSet } from "../lib/codeforces-adapter.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../../");

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
  const records = initial.map((record) => ({ ...record }));
  let nextId = 1;

  return {
    records,
    calls: [],
    async listExistingProblems() {
      return records.map((record) => ({ ...record }));
    },
    async createProblem(input) {
      this.calls.push({ type: "create", input });
      const record = {
        id: `created-${nextId++}`,
        ...input,
      };
      records.push(record);
      return { ...record };
    },
    async updateProblem(id, input) {
      this.calls.push({ type: "update", id, input });
      const index = records.findIndex((record) => record.id === id);
      assert.notEqual(index, -1, "record to update must exist");
      records[index] = {
        id,
        ...input,
      };
      return { ...records[index] };
    },
  };
}

describe("A480 Codeforces official metadata sync", () => {
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
    assert.equal(result.write.sourceUrl, "https://codeforces.com/problemset/problem/4/A");
    assert.deepEqual(result.write.tags, ["math", "brute force"]);
    assert.equal(result.write.metadata.contestId, 4);
    assert.equal(result.write.metadata.index, "A");
    assert.equal(result.write.metadata.rating, 800);
    assert.equal(result.write.metadata.originalUrl, "https://codeforces.com/problemset/problem/4/A");

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
      assert.equal(serialized.includes(token), false, `write payload must not include ${token}`);
    }
  });

  it("skips malformed records and duplicate records in the same API snapshot", () => {
    const adapted = adaptCodeforcesProblemSet(makeResponse([
      makeProblem(),
      makeProblem({ name: "Duplicate Watermelon" }),
      makeProblem({ contestId: undefined }),
      makeProblem({ index: "" }),
      makeProblem({ name: "" }),
      makeProblem({ contestId: 5, index: "B", name: "No Rating", rating: 0, tags: [] }),
    ]));

    assert.equal(adapted.totalFetched, 6);
    assert.equal(adapted.previews.length, 3);
    assert.ok(adapted.warnings.some((warning) => warning.includes("missing contestId")));
    assert.ok(adapted.warnings.some((warning) => warning.includes("missing index")));
    assert.ok(adapted.warnings.some((warning) => warning.includes("missing name")));
  });

  it("creates, updates, and then remains unchanged without duplicate rows", async () => {
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

    const fetchProblemSet = async () => makeResponse([
      makeProblem({ name: "Watermelon Updated", rating: 900, tags: ["math", "greedy"] }),
      makeProblem({ contestId: 5, index: "B", name: "New Problem", rating: undefined, tags: [] }),
      makeProblem({ contestId: 5, index: "B", name: "New Problem Duplicate" }),
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

    const updated = store.records.find((record) => record.id === "existing-1");
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

  it("legacy CLI is metadata-only and has no HTML page parser path", () => {
    const source = readFileSync(resolve(repoRoot, "scripts/import-codeforces-problems.mjs"), "utf8");

    assert.ok(source.includes("problemset.problems"));
    assert.ok(source.includes("syncCodeforcesProblemMetadata"));
    assert.equal(source.includes("CODEFORCES_PAGE_URL"), false);
    assert.equal(source.includes("parseCodeforcesProblemPage"), false);
    assert.equal(source.includes("htmlToPlainText"), false);
    assert.equal(source.includes("text/html"), false);
    assert.equal(source.includes("locale=en"), false);
  });
});
