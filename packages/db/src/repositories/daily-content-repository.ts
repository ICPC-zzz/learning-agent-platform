/**
 * DailyContent Repository — read/write daily content snapshots.
 *
 * Handles persistent storage of daily tech hotspots and GitHub repository
 * reports. Does NOT store full text, README content, or API tokens.
 *
 * @module daily-content-repository
 * @devOnly — uses Prisma shim, model not yet generated
 */

import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailyContentKind = "TECH_HOTSPOT" | "GITHUB_REPOSITORY";

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
  metadataJson: unknown;
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
  metadataJson?: unknown;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface DailyContentRepository {
  /** Upsert a batch of daily content items (idempotent per unique key) */
  upsertMany(inputs: DailyContentUpsertInput[]): Promise<number>;

  /** Get items for a specific date and kind */
  getByDate(date: Date, kind: DailyContentKind): Promise<DailyContentRecord[]>;

  /** Get items for a date range (for date switcher) */
  getByDateRange(
    startDate: Date,
    endDate: Date,
    kind: DailyContentKind,
  ): Promise<DailyContentRecord[]>;

  /** Get the most recent snapshot date for a kind */
  getLatestDate(kind: DailyContentKind): Promise<Date | null>;

  /** Count items for a date */
  countByDate(date: Date, kind: DailyContentKind): Promise<number>;
}

// ---------------------------------------------------------------------------
// Prisma implementation
// ---------------------------------------------------------------------------

export class PrismaDailyContentRepository implements DailyContentRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsertMany(inputs: DailyContentUpsertInput[]): Promise<number> {
    let upserted = 0;
    for (const input of inputs) {
      try {
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
      } catch {
        // Log and continue with next item
        continue;
      }
    }
    return upserted;
  }

  async getByDate(date: Date, kind: DailyContentKind): Promise<DailyContentRecord[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.dailyContentItem.findMany({
      where: { kind, dailyDate: { gte: startOfDay, lte: endOfDay } },
      orderBy: [{ score: "desc" }, { commentCount: "desc" }],
      take: 100,
    }) as unknown as DailyContentRecord[];
  }

  async getByDateRange(
    startDate: Date,
    endDate: Date,
    kind: DailyContentKind,
  ): Promise<DailyContentRecord[]> {
    return this.prisma.dailyContentItem.findMany({
      where: {
        kind,
        dailyDate: { gte: startDate, lte: endDate },
      },
      orderBy: [{ dailyDate: "desc" }, { score: "desc" }],
      take: 500,
    }) as unknown as DailyContentRecord[];
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
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.dailyContentItem.count({
      where: { kind, dailyDate: { gte: startOfDay, lte: endOfDay } },
    });
  }
}
