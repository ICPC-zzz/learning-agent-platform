import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PrismaArticleRepository } from "../packages/db/src/repositories/article-repository.ts";

describe("A517 article user state repository", () => {
  it("passes a seven-day cutoff into recent article reads without affecting favorites", async () => {
    const calls = [];
    const repository = new PrismaArticleRepository({
      articleFavorite: {
        findMany: async (args) => {
          calls.push(["favorite", args]);
          return [];
        },
      },
      articleReading: {
        findMany: async (args) => {
          calls.push(["reading", args]);
          return [];
        },
      },
    });
    const since = new Date("2026-06-21T00:00:00.000Z");

    await repository.listFavoriteArticlesByOwner({ userId: "u1", limit: 20 });
    await repository.listArticleReadingsByOwner({ userId: "u1", limit: 20, since });

    assert.equal(calls[0][1].where.userId, "u1");
    assert.equal(calls[0][1].where.lastReadAt, undefined);
    assert.deepEqual(calls[1][1].where.lastReadAt, { gte: since });
  });
});
