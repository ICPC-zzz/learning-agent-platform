import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  syncDailyHotTopics,
  syncGithubDailyReport,
} from "../apps/web/src/lib/content/daily-content-sync-job.ts";
import { PrismaDailyContentRepository as DbDailyContentRepository } from "../packages/db/src/repositories/daily-content-repository.ts";

describe("A517 content scheduler", () => {
  it("skips hot topic sync when last successful snapshot is still fresh", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const repository = fakeRepository({
      state: {
        name: "daily_hot_topics",
        status: "succeeded",
        lastAttemptAt: now,
        lastSuccessAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
    });

    const result = await syncDailyHotTopics({ now, repository });

    assert.equal(result.ok, true);
    assert.equal(result.status, "skipped");
    assert.equal(repository.lockCalls, 0);
  });

  it("skips github daily sync when another worker owns the DB lease", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const repository = fakeRepository({
      acquire: false,
      state: {
        name: "github_daily_report",
        status: "running",
        lastAttemptAt: now,
        lastSuccessAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      },
    });

    const result = await syncGithubDailyReport({ now, repository });

    assert.equal(result.ok, true);
    assert.equal(result.status, "skipped");
    assert.match(result.safeSummary, /正在运行/);
    assert.equal(repository.lockCalls, 1);
  });

  it("uses raw SQL sync-state access when Prisma Client has not regenerated the delegate", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const prisma = {
      executeCalls: 0,
      queryCalls: [],
      async $executeRawUnsafe() {
        this.executeCalls += 1;
        return 0;
      },
      async $queryRawUnsafe(sql, ...values) {
        this.queryCalls.push({ sql, values });
        if (sql.includes("WHERE \"name\"")) {
          return [{
            name: "daily_hot_topics",
            status: "succeeded",
            lastAttemptAt: now,
            lastSuccessAt: now,
            errorCode: null,
            safeSummary: "ok",
            leaseOwner: null,
            leaseExpiresAt: null,
            createdAt: now,
            updatedAt: now,
          }];
        }
        return [{
          name: values[0],
          status: values[1] ?? "running",
          lastAttemptAt: now,
          lastSuccessAt: values[1] === "succeeded" ? now : null,
          errorCode: values[2] ?? null,
          safeSummary: values[3] ?? "ok",
          leaseOwner: null,
          leaseExpiresAt: null,
          createdAt: now,
          updatedAt: now,
        }];
      },
    };
    const repository = new DbDailyContentRepository(prisma);

    const state = await repository.getSyncState("daily_hot_topics");
    const completed = await repository.completeSyncAttempt({
      name: "daily_hot_topics",
      status: "succeeded",
      safeSummary: "ok",
      now,
    });

    assert.equal(state.status, "succeeded");
    assert.equal(completed.status, "succeeded");
    assert.ok(prisma.executeCalls >= 1);
    assert.ok(prisma.queryCalls.some((call) => call.sql.includes("DailyContentSyncState")));
  });
});

function fakeRepository(options = {}) {
  return {
    lockCalls: 0,
    async getSyncState() {
      return options.state ?? null;
    },
    async tryAcquireSyncLock() {
      this.lockCalls += 1;
      return options.acquire ?? true;
    },
    async completeSyncAttempt(input) {
      return {
        name: input.name,
        status: input.status,
        lastAttemptAt: input.now ?? new Date(),
        lastSuccessAt: input.status === "succeeded" ? input.now ?? new Date() : options.state?.lastSuccessAt ?? null,
        errorCode: input.errorCode ?? null,
        safeSummary: input.safeSummary,
        leaseOwner: null,
        leaseExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
  };
}
