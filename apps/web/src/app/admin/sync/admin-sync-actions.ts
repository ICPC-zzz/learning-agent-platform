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
import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaDailyContentRepository,
  type DailyContentKind,
  type DailyContentSyncName,
} from "@learning-agent-platform/db";
import {
  syncDailyHotTopics,
  syncGithubDailyReport,
  syncTechnicalArticles,
  type DailyContentSyncJobResult,
} from "../../../lib/content/daily-content-sync-job";
import {
  AdminAuthorizationError,
  requireAdmin,
  toAdminActionDeniedResult,
} from "../../../lib/admin/admin-auth";
import { revalidatePath } from "next/cache";


// ---------------------------------------------------------------------------
// JSON output paths (match existing article data pattern)
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(
  resolveProjectRoot(),
  "apps/web/src/data",
);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
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
  articleCount?: number;
  articleAdded?: number;
  errors?: string[];
}

export interface SyncStatusItem {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  status: string;
  count: number;
  safeSummary: string | null;
  errorCode: string | null;
}


// ---------------------------------------------------------------------------
// Refresh hotspots
// ---------------------------------------------------------------------------

export async function adminRefreshHotspots(): Promise<SyncActionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return toAdminActionDeniedResult();
    return { success: false, message: "管理员权限校验失败。", errors: ["permission_check_failed"] };
  }

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
    const result = await syncDailyHotTopics({ force: true, leaseOwner: "admin-manual-hotspots" });

    // Also write to JSON for the page loader
    if (result.ok && result.saved > 0) {
      const dateKey = result.date;
      const records = await getTodayRecords("TECH_HOTSPOT", dateKey);
      writeDailyJson("daily-hotspots.generated.json", {
        generatedAt: new Date().toISOString(),
        date: dateKey,
        count: records.length,
        hotspots: records,
      });
    }

    revalidatePath("/admin/sync");
    revalidatePath("/articles");
    return mapJobResult(result);
  } catch (err) {
    return { success: false, message: "同步异常：已保留上一批成功数据。", errors: [safeError(err)] };
  }
}

// ---------------------------------------------------------------------------
// Refresh GitHub
// ---------------------------------------------------------------------------

export async function adminRefreshGitHub(): Promise<SyncActionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return toAdminActionDeniedResult();
    return { success: false, message: "管理员权限校验失败。", errors: ["permission_check_failed"] };
  }

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
    const result = await syncGithubDailyReport({ force: true, leaseOwner: "admin-manual-github" });

    // Also write to JSON for the page loader
    if (result.ok && result.saved > 0) {
      const dateKey = result.date;
      const records = await getTodayRecords("GITHUB_REPOSITORY", dateKey);
      writeDailyJson("daily-github.generated.json", {
        generatedAt: new Date().toISOString(),
        date: dateKey,
        count: records.length,
        repos: records,
      });
    }

    revalidatePath("/admin/sync");
    revalidatePath("/articles");
    return mapJobResult(result);
  } catch (err) {
    return { success: false, message: "同步异常：已保留上一批成功数据。", errors: [safeError(err)] };
  }
}

export async function adminRefreshArticles(): Promise<SyncActionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return toAdminActionDeniedResult();
    return { success: false, message: "管理员权限校验失败。", errors: ["permission_check_failed"] };
  }

  const key = "articles";
  const last = lastManualSync.get(key);
  if (last && Date.now() - last < MANUAL_COOLDOWN_MS) {
    return {
      success: false,
      message: `请等待 ${Math.ceil((MANUAL_COOLDOWN_MS - (Date.now() - last)) / 1000)} 秒后重试`,
    };
  }
  lastManualSync.set(key, Date.now());

  try {
    const result = await syncTechnicalArticles({ force: true, leaseOwner: "admin-manual-articles" });
    revalidatePath("/admin/sync");
    revalidatePath("/articles");
    return mapJobResult(result);
  } catch (err) {
    return { success: false, message: "技术文章同步异常：已保留上一批成功数据。", errors: [safeError(err)] };
  }
}

// ---------------------------------------------------------------------------
// Read today's records for JSON serialization
// ---------------------------------------------------------------------------

async function getTodayRecords(kind: DailyContentKind, dateKey: string) {
  const repository = new PrismaDailyContentRepository(getPrismaClient());
  const records = await repository.getByDate(new Date(dateKey), kind);
  return records.map((r) => ({
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

export async function adminGetSyncStatus(): Promise<{
  hotspots: SyncStatusItem;
  github: SyncStatusItem;
  articles: SyncStatusItem;
}> {
  await requireAdmin();
  const states = await readDbSyncStates();
  const dbCounts = await readDbContentCounts();
  return {
    hotspots: mergeSyncStatus(
      states.daily_hot_topics,
      { ...readGeneratedSyncStatus("daily-hotspots.generated.json", "hotspots"), count: dbCounts.hotspots },
    ),
    github: mergeSyncStatus(
      states.github_daily_report,
      { ...readGeneratedSyncStatus("daily-github.generated.json", "repos"), count: dbCounts.github },
    ),
    articles: mergeSyncStatus(states.technical_articles, readArticleSyncStatus()),
  };
}

function readArticleSyncStatus(): { lastSyncAt: string | null; count: number } {
  try {
    const filePath = path.join(DATA_DIR, "articles.generated.json");
    if (!fs.existsSync(filePath)) {
      return { lastSyncAt: null, count: 0 };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(parsed)) {
      return { lastSyncAt: null, count: 0 };
    }
    let latest = 0;
    for (const item of parsed as Array<Record<string, unknown>>) {
      if (typeof item.fetchedAt !== "string") continue;
      const time = new Date(item.fetchedAt).getTime();
      if (Number.isFinite(time) && time > latest) latest = time;
    }
    return {
      lastSyncAt: latest > 0 ? new Date(latest).toISOString() : null,
      count: parsed.length,
    };
  } catch {
    return { lastSyncAt: null, count: 0 };
  }
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split(/\r?\n/)[0] || error.name;
  }
  return String(error);
}

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.resolve(cwd, "services/article-feed-ingestor/ingest.py"))) {
    return cwd;
  }
  const monorepoRoot = path.resolve(cwd, "../..");
  if (fs.existsSync(path.resolve(monorepoRoot, "services/article-feed-ingestor/ingest.py"))) {
    return monorepoRoot;
  }
  return cwd;
}

function mapJobResult(result: DailyContentSyncJobResult): SyncActionResult {
  return {
    success: result.ok,
    message: result.safeSummary,
    date: result.date,
    fetched: result.fetched,
    saved: result.saved,
    articleCount: result.kind === "technical_articles" ? result.fetched : undefined,
    articleAdded: result.kind === "technical_articles" ? result.saved : undefined,
    errors: result.errorCode ? [result.errorCode] : [],
  };
}

async function readDbSyncStates(): Promise<Record<DailyContentSyncName, {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  status: string;
  safeSummary: string | null;
  errorCode: string | null;
} | null>> {
  const empty = {
    daily_hot_topics: null,
    github_daily_report: null,
    technical_articles: null,
  };
  if (!hasDatabaseUrl()) return empty;

  try {
    const repository = new PrismaDailyContentRepository(getPrismaClient());
    const entries = await Promise.all(
      (Object.keys(empty) as DailyContentSyncName[]).map(async (name) => {
        const state = await repository.getSyncState(name);
        return [name, state] as const;
      }),
    );
    return Object.fromEntries(entries.map(([name, state]) => [
      name,
      state
        ? {
            lastAttemptAt: state.lastAttemptAt?.toISOString() ?? null,
            lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
            status: state.status,
            safeSummary: state.safeSummary,
            errorCode: state.errorCode,
          }
        : null,
    ])) as Record<DailyContentSyncName, {
      lastAttemptAt: string | null;
      lastSuccessAt: string | null;
      status: string;
      safeSummary: string | null;
      errorCode: string | null;
    } | null>;
  } catch {
    return empty;
  }
}

async function readDbContentCounts(): Promise<{ hotspots: number; github: number }> {
  if (!hasDatabaseUrl()) return { hotspots: 0, github: 0 };
  try {
    const repository = new PrismaDailyContentRepository(getPrismaClient());
    const [hotspotDate, githubDate] = await Promise.all([
      repository.getLatestDate("TECH_HOTSPOT"),
      repository.getLatestDate("GITHUB_REPOSITORY"),
    ]);
    const [hotspots, github] = await Promise.all([
      hotspotDate ? repository.countByDate(hotspotDate, "TECH_HOTSPOT") : 0,
      githubDate ? repository.countByDate(githubDate, "GITHUB_REPOSITORY") : 0,
    ]);
    return { hotspots, github };
  } catch {
    return { hotspots: 0, github: 0 };
  }
}

function mergeSyncStatus(
  state: Awaited<ReturnType<typeof readDbSyncStates>>[DailyContentSyncName],
  fallback: { lastSyncAt: string | null; count: number },
): SyncStatusItem {
  return {
    lastAttemptAt: state?.lastAttemptAt ?? null,
    lastSuccessAt: state?.lastSuccessAt ?? fallback.lastSyncAt,
    status: state?.status ?? "idle",
    count: fallback.count,
    safeSummary: state?.safeSummary ?? null,
    errorCode: state?.errorCode ?? null,
  };
}
