import {
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaDailyContentRepository,
  type DailyContentSyncName,
} from "@learning-agent-platform/db";

import {
  syncDailyTechHotspots,
  type HotspotSyncResult,
} from "../daily-tech-hotspot-sync.ts";
import {
  syncGitHubDailyReport,
  type GitHubSyncResult,
} from "../github-daily-report-sync.ts";

const execFileAsync = promisify(execFile);

export type DailyContentSyncJobKind = "hot" | "github" | "technical_articles";

export interface DailyContentSyncJobResult {
  ok: boolean;
  kind: DailyContentSyncJobKind;
  status: "succeeded" | "failed" | "skipped";
  date: string;
  saved: number;
  fetched: number;
  errorCode: string | null;
  safeSummary: string;
  lastSuccessAt: string | null;
  lastAttemptAt?: string | null;
}

export interface DailyContentSyncJobOptions {
  date?: Date;
  force?: boolean;
  now?: Date;
  leaseOwner?: string;
  repository?: PrismaDailyContentRepository;
}

const HOT_MIN_INTERVAL_MS = 60 * 60 * 1000;
const GITHUB_MIN_INTERVAL_MS = 23 * 60 * 60 * 1000;
const TECHNICAL_ARTICLES_MIN_INTERVAL_MS = 60 * 60 * 1000;
const LOCK_LEASE_MS = 10 * 60 * 1000;
const PROJECT_ROOT = resolveProjectRoot();
const DATA_DIR = path.resolve(PROJECT_ROOT, "apps/web/src/data");
const ARTICLES_FILE = path.join(DATA_DIR, "articles.generated.json");
const INGEST_SCRIPT = path.resolve(PROJECT_ROOT, "services/article-feed-ingestor/ingest.py");
const INGEST_VENV_PYTHON = path.resolve(
  PROJECT_ROOT,
  process.platform === "win32"
    ? "services/article-feed-ingestor/.venv/Scripts/python.exe"
    : "services/article-feed-ingestor/.venv/bin/python",
);

export async function syncDailyHotTopics(
  options: DailyContentSyncJobOptions = {},
): Promise<DailyContentSyncJobResult> {
  return runSyncJob({
    kind: "hot",
    name: "daily_hot_topics",
    minIntervalMs: HOT_MIN_INTERVAL_MS,
    options,
    execute: (date, repository) => syncDailyTechHotspots(date, repository),
    summarize: summarizeHotspotResult,
  });
}

export async function syncGithubDailyReport(
  options: DailyContentSyncJobOptions = {},
): Promise<DailyContentSyncJobResult> {
  return runSyncJob({
    kind: "github",
    name: "github_daily_report",
    minIntervalMs: GITHUB_MIN_INTERVAL_MS,
    options,
    execute: (date, repository) => syncGitHubDailyReport(date, repository),
    summarize: summarizeGithubResult,
  });
}

export async function syncTechnicalArticles(
  options: DailyContentSyncJobOptions = {},
): Promise<DailyContentSyncJobResult> {
  const date = options.date ?? new Date();
  const now = options.now ?? new Date();
  const dateKey = date.toISOString().slice(0, 10);
  const repository = options.repository ?? createDefaultRepository();
  if (!repository) {
    return {
      ok: false,
      kind: "technical_articles",
      status: "failed",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: "database_unavailable",
      safeSummary: "数据库未配置，技术文章同步没有执行。",
      lastSuccessAt: null,
      lastAttemptAt: null,
    };
  }

  const previous = await repository.getSyncState("technical_articles");
  if (
    !options.force
    && previous?.lastSuccessAt
    && now.getTime() - previous.lastSuccessAt.getTime() < TECHNICAL_ARTICLES_MIN_INTERVAL_MS
  ) {
    return {
      ok: true,
      kind: "technical_articles",
      status: "skipped",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: null,
      safeSummary: "上一份技术文章快照仍然新鲜，本次未重复同步。",
      lastSuccessAt: previous.lastSuccessAt.toISOString(),
      lastAttemptAt: previous.lastAttemptAt?.toISOString() ?? null,
    };
  }

  const leaseOwner = options.leaseOwner ?? `a518-technical-${process.pid}-${Date.now()}`;
  const acquired = await repository.tryAcquireSyncLock({
    name: "technical_articles",
    leaseOwner,
    leaseMs: LOCK_LEASE_MS,
    now,
  });
  if (!acquired) {
    return {
      ok: true,
      kind: "technical_articles",
      status: "skipped",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: null,
      safeSummary: "已有技术文章同步任务正在运行，本次跳过以避免重复写入。",
      lastSuccessAt: previous?.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: previous?.lastAttemptAt?.toISOString() ?? null,
    };
  }

  const beforeCount = countGeneratedArticles();
  const result = await runTechnicalArticleIngestor();
  const afterCount = countGeneratedArticles();
  const added = Math.max(0, afterCount - beforeCount);
  const succeeded = result.ok && afterCount > 0;
  const safeSummary = succeeded
    ? `技术文章同步完成：当前 ${afterCount} 篇，本次新增 ${added} 篇。`
    : `技术文章同步失败或没有可用结果，已保留旧文章。${result.safeError ? ` ${result.safeError}` : ""}`.trim();
  const state = await repository.completeSyncAttempt({
    name: "technical_articles",
    status: succeeded ? "succeeded" : "failed",
    errorCode: succeeded ? null : result.errorCode,
    safeSummary,
    now: new Date(),
  });

  return {
    ok: succeeded,
    kind: "technical_articles",
    status: succeeded ? "succeeded" : "failed",
    date: dateKey,
    saved: added,
    fetched: afterCount,
    errorCode: succeeded ? null : result.errorCode,
    safeSummary,
    lastSuccessAt: state.lastSuccessAt?.toISOString() ?? previous?.lastSuccessAt?.toISOString() ?? null,
    lastAttemptAt: state.lastAttemptAt?.toISOString() ?? null,
  };
}

export async function syncAllDailyContent(
  options: DailyContentSyncJobOptions = {},
): Promise<DailyContentSyncJobResult[]> {
  return [
    await syncDailyHotTopics(options),
    await syncGithubDailyReport(options),
    await syncTechnicalArticles(options),
  ];
}

async function runSyncJob<T extends HotspotSyncResult | GitHubSyncResult>(input: {
  kind: DailyContentSyncJobKind;
  name: DailyContentSyncName;
  minIntervalMs: number;
  options: DailyContentSyncJobOptions;
  execute: (date: Date, repository: PrismaDailyContentRepository) => Promise<T>;
  summarize: (result: T) => { fetched: number; saved: number; safeSummary: string; errorCode: string | null };
}): Promise<DailyContentSyncJobResult> {
  const date = input.options.date ?? new Date();
  const now = input.options.now ?? new Date();
  const dateKey = date.toISOString().slice(0, 10);
  const repository = input.options.repository ?? createDefaultRepository();
  if (!repository) {
    return {
      ok: false,
      kind: input.kind,
      status: "failed",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: "database_unavailable",
      safeSummary: "数据库未配置，内容同步没有执行。",
      lastSuccessAt: null,
    };
  }

  const previous = await repository.getSyncState(input.name);
  if (!input.options.force && previous?.lastSuccessAt && now.getTime() - previous.lastSuccessAt.getTime() < input.minIntervalMs) {
    return {
      ok: true,
      kind: input.kind,
      status: "skipped",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: null,
      safeSummary: "上一份成功快照仍然新鲜，本次未重复同步。",
      lastSuccessAt: previous.lastSuccessAt.toISOString(),
      lastAttemptAt: previous.lastAttemptAt?.toISOString() ?? null,
    };
  }

  const leaseOwner = input.options.leaseOwner ?? `a517-${process.pid}-${Date.now()}`;
  const acquired = await repository.tryAcquireSyncLock({
    name: input.name,
    leaseOwner,
    leaseMs: LOCK_LEASE_MS,
    now,
  });
  if (!acquired) {
    return {
      ok: true,
      kind: input.kind,
      status: "skipped",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: null,
      safeSummary: "已有同类同步任务正在运行，本次跳过以避免重复写入。",
      lastSuccessAt: previous?.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: previous?.lastAttemptAt?.toISOString() ?? null,
    };
  }

  try {
    const result = await input.execute(date, repository);
    const summary = input.summarize(result);
    const status = result.success && summary.saved > 0 ? "succeeded" : "failed";
    const errorCode = status === "succeeded"
      ? null
      : summary.errorCode ?? "empty_or_failed_sync";
    const state = await repository.completeSyncAttempt({
      name: input.name,
      status,
      errorCode,
      safeSummary: summary.safeSummary,
      now: new Date(),
    });

    return {
      ok: status === "succeeded",
      kind: input.kind,
      status,
      date: dateKey,
      saved: summary.saved,
      fetched: summary.fetched,
      errorCode,
      safeSummary: summary.safeSummary,
      lastSuccessAt: state.lastSuccessAt?.toISOString() ?? previous?.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: state.lastAttemptAt?.toISOString() ?? null,
    };
  } catch {
    await repository.completeSyncAttempt({
      name: input.name,
      status: "failed",
      errorCode: "sync_exception",
      safeSummary: "内容同步执行失败，已保留上一次成功快照。",
      now: new Date(),
    });
    return {
      ok: false,
      kind: input.kind,
      status: "failed",
      date: dateKey,
      saved: 0,
      fetched: 0,
      errorCode: "sync_exception",
      safeSummary: "内容同步执行失败，已保留上一次成功快照。",
      lastSuccessAt: previous?.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: previous?.lastAttemptAt?.toISOString() ?? null,
    };
  }
}

async function runTechnicalArticleIngestor(): Promise<{
  ok: boolean;
  errorCode: string | null;
  safeError: string | null;
}> {
  if (!existsSync(INGEST_SCRIPT)) {
    return {
      ok: false,
      errorCode: "technical_article_ingestor_missing",
      safeError: "技术文章采集器不存在。",
    };
  }

  mkdirSync(DATA_DIR, { recursive: true });
  const candidates = [
    ...(existsSync(INGEST_VENV_PYTHON)
      ? [{ command: INGEST_VENV_PYTHON, args: [INGEST_SCRIPT] }]
      : []),
    ...(process.platform === "win32"
      ? [
        { command: "python", args: [INGEST_SCRIPT] },
        { command: "py", args: ["-3", INGEST_SCRIPT] },
      ]
      : [
        { command: "python3", args: [INGEST_SCRIPT] },
        { command: "python", args: [INGEST_SCRIPT] },
      ]),
  ];

  let firstError: unknown = null;
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, candidate.args, {
        cwd: PROJECT_ROOT,
        timeout: 360_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      return { ok: true, errorCode: null, safeError: null };
    } catch (error) {
      firstError ??= error;
    }
  }

  return {
    ok: false,
    errorCode: "technical_article_ingest_failed",
    safeError: safeError(firstError),
  };
}

function countGeneratedArticles(): number {
  try {
    if (!existsSync(ARTICLES_FILE)) return 0;
    const parsed = JSON.parse(readFileSync(ARTICLES_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    const firstLine = error.message.split(/\r?\n/)[0]?.trim();
    return firstLine ? limitText(firstLine, 160) : error.name;
  }
  return limitText(String(error), 160);
}

function limitText(value: string, maxChars: number): string {
  const text = String(value ?? "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (existsSync(path.resolve(cwd, "services/article-feed-ingestor/ingest.py"))) {
    return cwd;
  }
  const monorepoRoot = path.resolve(cwd, "../..");
  if (existsSync(path.resolve(monorepoRoot, "services/article-feed-ingestor/ingest.py"))) {
    return monorepoRoot;
  }
  return cwd;
}

function createDefaultRepository(): PrismaDailyContentRepository | null {
  if (!hasDatabaseUrl()) {
    return null;
  }
  return new PrismaDailyContentRepository(getPrismaClient());
}

function summarizeHotspotResult(result: HotspotSyncResult): {
  fetched: number;
  saved: number;
  safeSummary: string;
  errorCode: string | null;
} {
  const errorCode = result.errors.length > 0
    ? "hot_topics_partial_or_failed"
    : result.saved > 0
      ? null
      : "hot_topics_empty_result";
  return {
    fetched: result.totalFetched,
    saved: result.saved,
    safeSummary: result.saved > 0
      ? `每日热点同步完成：获取 ${result.totalFetched} 条，去重后 ${result.afterDedup} 条，保存 ${result.saved} 条。`
      : "每日热点同步未产生新快照，已保留上一次成功数据。",
    errorCode,
  };
}

function summarizeGithubResult(result: GitHubSyncResult): {
  fetched: number;
  saved: number;
  safeSummary: string;
  errorCode: string | null;
} {
  const errorCode = result.errors.length > 0
    ? "github_daily_partial_or_failed"
    : result.saved > 0
      ? null
      : "github_daily_empty_result";
  return {
    fetched: result.fetched,
    saved: result.saved,
    safeSummary: result.saved > 0
      ? `GitHub 日报同步完成：获取 ${result.fetched} 个仓库，保存 ${result.saved} 条。`
      : "GitHub 日报同步未产生新快照，已保留上一次成功数据。",
    errorCode,
  };
}
