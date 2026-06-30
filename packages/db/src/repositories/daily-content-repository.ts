import type { Prisma, PrismaClient } from "@prisma/client";

export type DailyContentKind = "TECH_HOTSPOT" | "GITHUB_REPOSITORY";
export type DailyContentSyncName = "daily_hot_topics" | "github_daily_report" | "technical_articles";
export type DailyContentSyncStatus = "idle" | "running" | "succeeded" | "failed" | "skipped";

export interface DailyContentRecord {
  id: string;
  kind: DailyContentKind;
  source: string;
  externalId: string;
  title: string;
  summary: string | null;
  originalUrl: string | null;
  discussionUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
  dailyDate: Date;
  score: number | null;
  commentCount: number | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyContentUpsertInput {
  kind: DailyContentKind;
  source: string;
  externalId: string;
  title: string;
  summary?: string | null;
  originalUrl?: string | null;
  discussionUrl?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
  dailyDate: Date;
  score?: number | null;
  commentCount?: number | null;
  metadataJson?: Prisma.InputJsonValue;
}

export interface DailyContentRepository {
  upsertMany(inputs: DailyContentUpsertInput[]): Promise<number>;
  getByDate(date: Date, kind: DailyContentKind): Promise<DailyContentRecord[]>;
  getByDateRange(startDate: Date, endDate: Date, kind: DailyContentKind): Promise<DailyContentRecord[]>;
  getLatestDate(kind: DailyContentKind): Promise<Date | null>;
  countByDate(date: Date, kind: DailyContentKind): Promise<number>;
}

export interface DailyContentSyncStateRecord {
  name: DailyContentSyncName;
  status: DailyContentSyncStatus;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  errorCode: string | null;
  safeSummary: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcquireDailyContentSyncLockInput {
  name: DailyContentSyncName;
  leaseOwner: string;
  leaseMs: number;
  now?: Date;
}

export interface CompleteDailyContentSyncInput {
  name: DailyContentSyncName;
  status: Exclude<DailyContentSyncStatus, "idle" | "running">;
  safeSummary: string;
  errorCode?: string | null;
  now?: Date;
}

export class PrismaDailyContentRepository implements DailyContentRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsertMany(inputs: DailyContentUpsertInput[]): Promise<number> {
    let upserted = 0;
    for (const input of inputs) {
      await this.prisma.dailyContentItem.upsert({
        where: {
          kind_source_externalId_dailyDate: {
            kind: input.kind,
            source: input.source,
            externalId: input.externalId,
            dailyDate: input.dailyDate,
          },
        },
        create: {
          kind: input.kind,
          source: input.source,
          externalId: input.externalId,
          title: input.title,
          summary: input.summary ?? null,
          originalUrl: input.originalUrl ?? null,
          discussionUrl: input.discussionUrl ?? null,
          author: input.author ?? null,
          publishedAt: input.publishedAt ?? null,
          dailyDate: input.dailyDate,
          score: input.score ?? null,
          commentCount: input.commentCount ?? null,
          metadataJson: input.metadataJson ?? undefined,
        },
        update: {
          title: input.title,
          summary: input.summary ?? null,
          originalUrl: input.originalUrl ?? null,
          discussionUrl: input.discussionUrl ?? null,
          author: input.author ?? null,
          publishedAt: input.publishedAt ?? null,
          score: input.score ?? null,
          commentCount: input.commentCount ?? null,
          metadataJson: input.metadataJson ?? undefined,
        },
      });
      upserted += 1;
    }
    return upserted;
  }

  async getByDate(date: Date, kind: DailyContentKind): Promise<DailyContentRecord[]> {
    const { startOfDay, endOfDay } = getDayRange(date);
    return this.prisma.dailyContentItem.findMany({
      where: { kind, dailyDate: { gte: startOfDay, lte: endOfDay } },
      orderBy: [{ score: "desc" }, { commentCount: "desc" }],
      take: 100,
    }) as Promise<DailyContentRecord[]>;
  }

  async getByDateRange(startDate: Date, endDate: Date, kind: DailyContentKind): Promise<DailyContentRecord[]> {
    return this.prisma.dailyContentItem.findMany({
      where: {
        kind,
        dailyDate: { gte: startDate, lte: endDate },
      },
      orderBy: [{ dailyDate: "desc" }, { score: "desc" }],
      take: 500,
    }) as Promise<DailyContentRecord[]>;
  }

  async getLatestDate(kind: DailyContentKind): Promise<Date | null> {
    const result = await this.prisma.dailyContentItem.findFirst({
      where: { kind },
      orderBy: { dailyDate: "desc" },
      select: { dailyDate: true },
    });
    return result?.dailyDate ?? null;
  }

  async countByDate(date: Date, kind: DailyContentKind): Promise<number> {
    const { startOfDay, endOfDay } = getDayRange(date);
    return this.prisma.dailyContentItem.count({
      where: { kind, dailyDate: { gte: startOfDay, lte: endOfDay } },
    });
  }

  async getSyncState(name: DailyContentSyncName): Promise<DailyContentSyncStateRecord | null> {
    const delegate = this.optionalSyncStateDelegate();
    if (!delegate) {
      const record = await this.rawGetSyncState(name);
      return record ? normalizeSyncStateRecord(record) : null;
    }

    const record = await delegate.findUnique({ where: { name } });
    return record ? normalizeSyncStateRecord(record) : null;
  }

  async tryAcquireSyncLock(input: AcquireDailyContentSyncLockInput): Promise<boolean> {
    const now = input.now ?? new Date();
    const leaseExpiresAt = new Date(now.getTime() + normalizeLeaseMs(input.leaseMs));
    const current = await this.getSyncState(input.name);
    if (
      current?.status === "running" &&
      current.leaseExpiresAt instanceof Date &&
      current.leaseExpiresAt.getTime() > now.getTime()
    ) {
      return false;
    }

    const delegate = this.optionalSyncStateDelegate();
    if (!delegate) {
      await this.rawUpsertRunningSyncState({
        name: input.name,
        now,
        leaseOwner: input.leaseOwner,
        leaseExpiresAt,
      });
      return true;
    }

    await delegate.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        status: "running",
        lastAttemptAt: now,
        errorCode: null,
        safeSummary: "同步任务已开始。",
        leaseOwner: input.leaseOwner,
        leaseExpiresAt,
      },
      update: {
        status: "running",
        lastAttemptAt: now,
        errorCode: null,
        safeSummary: "同步任务已开始。",
        leaseOwner: input.leaseOwner,
        leaseExpiresAt,
      },
    });
    return true;
  }

  async completeSyncAttempt(input: CompleteDailyContentSyncInput): Promise<DailyContentSyncStateRecord> {
    const now = input.now ?? new Date();
    const delegate = this.optionalSyncStateDelegate();
    if (!delegate) {
      const record = await this.rawCompleteSyncAttempt({
        ...input,
        now,
      });
      return normalizeSyncStateRecord(record);
    }

    const record = await delegate.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        status: input.status,
        lastAttemptAt: now,
        lastSuccessAt: input.status === "succeeded" ? now : null,
        errorCode: input.errorCode ?? null,
        safeSummary: limitText(input.safeSummary, 500),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
      update: {
        status: input.status,
        lastSuccessAt: input.status === "succeeded" ? now : undefined,
        errorCode: input.errorCode ?? null,
        safeSummary: limitText(input.safeSummary, 500),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    return normalizeSyncStateRecord(record);
  }

  private optionalSyncStateDelegate(): {
    findUnique(args: unknown): Promise<unknown | null>;
    upsert(args: unknown): Promise<unknown>;
  } | null {
    const delegate = (this.prisma as unknown as {
      dailyContentSyncState?: {
        findUnique(args: unknown): Promise<unknown | null>;
        upsert(args: unknown): Promise<unknown>;
      };
    }).dailyContentSyncState;
    return delegate && typeof delegate.findUnique === "function" && typeof delegate.upsert === "function"
      ? delegate
      : null;
  }

  private async rawGetSyncState(name: DailyContentSyncName): Promise<unknown | null> {
    await this.ensureSyncStateTable();
    const rows = await this.rawQuery(`
      SELECT
        "name",
        "status",
        "lastAttemptAt",
        "lastSuccessAt",
        "errorCode",
        "safeSummary",
        "leaseOwner",
        "leaseExpiresAt",
        "createdAt",
        "updatedAt"
      FROM "DailyContentSyncState"
      WHERE "name" = $1
      LIMIT 1
    `, name);
    return rows[0] ?? null;
  }

  private async rawUpsertRunningSyncState(input: {
    name: DailyContentSyncName;
    now: Date;
    leaseOwner: string;
    leaseExpiresAt: Date;
  }): Promise<void> {
    await this.ensureSyncStateTable();
    await this.rawQuery(`
      INSERT INTO "DailyContentSyncState" (
        "name",
        "status",
        "lastAttemptAt",
        "errorCode",
        "safeSummary",
        "leaseOwner",
        "leaseExpiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, 'running', $2, NULL, 'Sync task started.', $3, $4, $2, $2)
      ON CONFLICT ("name") DO UPDATE SET
        "status" = 'running',
        "lastAttemptAt" = EXCLUDED."lastAttemptAt",
        "errorCode" = NULL,
        "safeSummary" = EXCLUDED."safeSummary",
        "leaseOwner" = EXCLUDED."leaseOwner",
        "leaseExpiresAt" = EXCLUDED."leaseExpiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "name"
    `, input.name, input.now, input.leaseOwner, input.leaseExpiresAt);
  }

  private async rawCompleteSyncAttempt(
    input: CompleteDailyContentSyncInput & { now: Date },
  ): Promise<unknown> {
    await this.ensureSyncStateTable();
    const rows = await this.rawQuery(`
      INSERT INTO "DailyContentSyncState" (
        "name",
        "status",
        "lastAttemptAt",
        "lastSuccessAt",
        "errorCode",
        "safeSummary",
        "leaseOwner",
        "leaseExpiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $5,
        CASE WHEN $2 = 'succeeded' THEN $5 ELSE NULL END,
        $3,
        $4,
        NULL,
        NULL,
        $5,
        $5
      )
      ON CONFLICT ("name") DO UPDATE SET
        "status" = EXCLUDED."status",
        "lastAttemptAt" = EXCLUDED."lastAttemptAt",
        "lastSuccessAt" = CASE
          WHEN EXCLUDED."status" = 'succeeded'
            THEN EXCLUDED."lastSuccessAt"
          ELSE "DailyContentSyncState"."lastSuccessAt"
        END,
        "errorCode" = EXCLUDED."errorCode",
        "safeSummary" = EXCLUDED."safeSummary",
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING
        "name",
        "status",
        "lastAttemptAt",
        "lastSuccessAt",
        "errorCode",
        "safeSummary",
        "leaseOwner",
        "leaseExpiresAt",
        "createdAt",
        "updatedAt"
    `, input.name, input.status, input.errorCode ?? null, limitText(input.safeSummary, 500), input.now);
    return rows[0];
  }

  private async ensureSyncStateTable(): Promise<void> {
    const prisma = this.prisma as unknown as {
      $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<unknown>;
    };
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailyContentSyncState" (
        "name" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'idle',
        "lastAttemptAt" TIMESTAMP(3),
        "lastSuccessAt" TIMESTAMP(3),
        "errorCode" TEXT,
        "safeSummary" TEXT,
        "leaseOwner" TEXT,
        "leaseExpiresAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "DailyContentSyncState_pkey" PRIMARY KEY ("name")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailyContentSyncState_status_leaseExpiresAt_idx"
      ON "DailyContentSyncState"("status", "leaseExpiresAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailyContentSyncState_lastSuccessAt_idx"
      ON "DailyContentSyncState"("lastSuccessAt")
    `);
  }

  private async rawQuery(sql: string, ...values: unknown[]): Promise<unknown[]> {
    const prisma = this.prisma as unknown as {
      $queryRawUnsafe(sql: string, ...values: unknown[]): Promise<unknown[]>;
    };
    return prisma.$queryRawUnsafe(sql, ...values);
  }
}

function getDayRange(date: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

function normalizeLeaseMs(value: number): number {
  if (!Number.isFinite(value)) return 10 * 60 * 1000;
  return Math.min(Math.max(Math.trunc(value), 30_000), 30 * 60 * 1000);
}

function limitText(value: string, maxChars: number): string {
  const text = String(value ?? "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeSyncStateRecord(value: unknown): DailyContentSyncStateRecord {
  const record = value as Record<string, unknown>;
  return {
    name: record.name as DailyContentSyncName,
    status: record.status as DailyContentSyncStatus,
    lastAttemptAt: record.lastAttemptAt instanceof Date ? record.lastAttemptAt : null,
    lastSuccessAt: record.lastSuccessAt instanceof Date ? record.lastSuccessAt : null,
    errorCode: typeof record.errorCode === "string" ? record.errorCode : null,
    safeSummary: typeof record.safeSummary === "string" ? record.safeSummary : null,
    leaseOwner: typeof record.leaseOwner === "string" ? record.leaseOwner : null,
    leaseExpiresAt: record.leaseExpiresAt instanceof Date ? record.leaseExpiresAt : null,
    createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(0),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(0),
  };
}
