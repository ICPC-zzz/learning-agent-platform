"use server";

/**
 * Admin Sync Actions — refreshes daily hotspots and GitHub reports,
 * then writes results to a JSON file for the article center page to consume.
 *
 * Synchronizes to BOTH the database and a local JSON file.
 * The JSON file path follows the same pattern as the existing
 * articles.generated.json used by blog园/CSDN.
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { syncDailyTechHotspots } from "../../../lib/daily-tech-hotspot-sync";
import { syncGitHubDailyReport } from "../../../lib/github-daily-report-sync";

// ---------------------------------------------------------------------------
// JSON output paths (match existing article data pattern)
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(
  process.cwd(),
  "apps/web/src/data",
);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Repository adapter — writes to Prisma + JSON
// ---------------------------------------------------------------------------

function makeRepository() {
  const prisma = new PrismaClient();

  return {
    upsertMany: async (inputs: Array<Record<string, unknown>>) => {
      let upserted = 0;
      for (const input of inputs) {
        try {
          await (prisma as any).dailyContentItem.upsert({
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
              publishedAt:
                input.publishedAt instanceof Date
                  ? input.publishedAt
                  : input.publishedAt
                    ? new Date(input.publishedAt as string)
                    : null,
              dailyDate: input.dailyDate,
              score: input.score ?? null,
              commentCount: input.commentCount ?? null,
              metadataJson: input.metadataJson ?? null,
            },
            update: {
              title: input.title,
              summary: input.summary ?? null,
              score: input.score ?? null,
              commentCount: input.commentCount ?? null,
              metadataJson: input.metadataJson ?? null,
            },
          });
          upserted += 1;
        } catch {
          continue;
        }
      }
      return upserted;
    },
  };
}

// ---------------------------------------------------------------------------
// JSON serialization helpers
// ---------------------------------------------------------------------------

function serializeForJson(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  }));
}

function writeDailyJson(filename: string, data: unknown) {
  ensureDataDir();
  fs.writeFileSync(
    path.join(DATA_DIR, filename),
    JSON.stringify(serializeForJson(data), null, 2),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Cooldown state
// ---------------------------------------------------------------------------

const MANUAL_COOLDOWN_MS = 60 * 1000;
const lastManualSync = new Map<string, number>();

export interface SyncActionResult {
  success: boolean;
  message: string;
  date?: string;
  fetched?: number;
  saved?: number;
  errors?: string[];
}

// ---------------------------------------------------------------------------
// Refresh hotspots
// ---------------------------------------------------------------------------

export async function adminRefreshHotspots(): Promise<SyncActionResult> {
  const key = "hotspots";
  const last = lastManualSync.get(key);
  if (last && Date.now() - last < MANUAL_COOLDOWN_MS) {
    return {
      success: false,
      message: `请等待 ${Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - last)) / 1000)} 秒后重试`,
    };
  }
  lastManualSync.set(key, Date.now());

  try {
    const repository = makeRepository();
    const today = new Date();
    const result = await syncDailyTechHotspots(today, repository as any);

    // Also write to JSON for the page loader
    if (result.success && result.saved > 0) {
      const dateKey = today.toISOString().slice(0, 10);
      const records = await getTodayRecords("TECH_HOTSPOT", dateKey);
      writeDailyJson("daily-hotspots.generated.json", {
        generatedAt: new Date().toISOString(),
        date: dateKey,
        count: records.length,
        hotspots: records,
      });
    }

    return {
      success: result.success,
      message: result.success
        ? `同步完成：获取 ${result.totalFetched} 条，去重后 ${result.afterDedup} 条，保存 ${result.saved} 条`
        : "同步失败，请查看错误日志",
      date: result.date,
      fetched: result.totalFetched,
      saved: result.saved,
      errors: result.errors,
    };
  } catch (err) {
    return { success: false, message: `同步异常: ${String(err)}`, errors: [String(err)] };
  }
}

// ---------------------------------------------------------------------------
// Refresh GitHub
// ---------------------------------------------------------------------------

export async function adminRefreshGitHub(): Promise<SyncActionResult> {
  const key = "github";
  const last = lastManualSync.get(key);
  if (last && Date.now() - last < MANUAL_COOLDOWN_MS) {
    return {
      success: false,
      message: `请等待 ${Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - last)) / 1000)} 秒后重试`,
    };
  }
  lastManualSync.set(key, Date.now());

  try {
    const repository = makeRepository();
    const today = new Date();
    const result = await syncGitHubDailyReport(today, repository as any);

    // Also write to JSON for the page loader
    if (result.success && result.saved > 0) {
      const dateKey = today.toISOString().slice(0, 10);
      const records = await getTodayRecords("GITHUB_REPOSITORY", dateKey);
      writeDailyJson("daily-github.generated.json", {
        generatedAt: new Date().toISOString(),
        date: dateKey,
        count: records.length,
        repos: records,
      });
    }

    return {
      success: result.success,
      message: result.success
        ? `同步完成：获取 ${result.fetched} 个仓库，去重后 ${result.afterFilter} 条，保存 ${result.saved} 条`
        : "同步失败，请查看错误日志",
      date: result.date,
      fetched: result.fetched,
      saved: result.saved,
      errors: result.errors,
    };
  } catch (err) {
    return { success: false, message: `同步异常: ${String(err)}`, errors: [String(err)] };
  }
}

// ---------------------------------------------------------------------------
// Read today's records for JSON serialization
// ---------------------------------------------------------------------------

async function getTodayRecords(kind: string, dateKey: string) {
  const prisma = new PrismaClient();
  try {
    const date = new Date(dateKey);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const records = await (prisma as any).dailyContentItem.findMany({
      where: { kind, dailyDate: { gte: start, lte: end } },
      orderBy: [{ score: "desc" }, { commentCount: "desc" }],
      take: kind === "TECH_HOTSPOT" ? 100 : 50,
    });

    return records.map((r: any) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      originalUrl: r.originalUrl,
      discussionUrl: r.discussionUrl,
      author: r.author,
      source: r.source,
      publishedAt: r.publishedAt,
      score: r.score,
      commentCount: r.commentCount,
      metadataJson: r.metadataJson,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Read generated JSON sync status
// ---------------------------------------------------------------------------

function readGeneratedSyncStatus(
  filename: string,
  collectionKey: string,
): { lastSyncAt: string | null; count: number } {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return { lastSyncAt: null, count: 0 };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    const collection = parsed[collectionKey];
    const count =
      typeof parsed.count === "number" && Number.isFinite(parsed.count)
        ? parsed.count
        : Array.isArray(collection)
          ? collection.length
          : 0;

    return {
      lastSyncAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
      count,
    };
  } catch {
    return { lastSyncAt: null, count: 0 };
  }
}

export async function adminGetSyncStatus() {
  return {
    hotspots: readGeneratedSyncStatus("daily-hotspots.generated.json", "hotspots"),
    github: readGeneratedSyncStatus("daily-github.generated.json", "repos"),
  };
}
