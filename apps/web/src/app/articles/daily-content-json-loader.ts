/**
 * Daily Content JSON Loader — reads daily hotspots and GitHub reports
 * from local JSON files, following the same pattern as the existing
 * articles.generated.json loader (no Prisma, no database).
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyHotspotItem {
  id: string;
  title: string;
  summary: string | null;
  originalUrl: string | null;
  discussionUrl: string | null;
  author: string | null;
  source: string;
  sourceLabel: string;
  publishedAt: string | null;
  score: number;
  commentCount: number;
  tags: string[];
}

export interface GitHubDailyItem {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  starDelta24h: number | null;
  forks: number;
  license: string | null;
  pushedAt: string | null;
  latestReleaseTag: string | null;
  isFirstDay: boolean;
  reasons: string[];
}

export interface DailyContentPageData {
  hotspots: DailyHotspotItem[];
  githubRepos: GitHubDailyItem[];
  selectedDate: string;
  availableDates: string[];
  hotspotCount: number;
  githubCount: number;
  generatedAt: string | null;
  hotspotGeneratedAt: string | null;
  githubGeneratedAt: string | null;
}

// ---------------------------------------------------------------------------
// Source labels
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  hackernews: "Hacker News",
  forem: "DEV Community",
};

// ---------------------------------------------------------------------------
// File paths (follow same pattern as article-library-loader.ts)
// ---------------------------------------------------------------------------

const DEFAULT_DATA_PATHS = [
  path.resolve(process.cwd(), "apps/web/src/data"),
  path.resolve(process.cwd(), "src/data"),
];

function resolveDataDir(): string {
  for (const candidate of DEFAULT_DATA_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return DEFAULT_DATA_PATHS[0];
}

function readJsonFile(filename: string): Record<string, unknown> | null {
  const dir = resolveDataDir();
  const filePath = path.join(dir, filename);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load daily content from the generated JSON files.
 * Falls back gracefully if either file doesn't exist yet.
 */
export function loadDailyContent(date?: Date): DailyContentPageData {
  const selectedDate = date ?? new Date();
  const dateKey = selectedDate.toISOString().slice(0, 10);

  const hotspotFile = readJsonFile("daily-hotspots.generated.json");
  const githubFile = readJsonFile("daily-github.generated.json");

  // Map hotspots
  const hotspots: DailyHotspotItem[] = [];
  if (hotspotFile && Array.isArray(hotspotFile.hotspots)) {
    for (const item of hotspotFile.hotspots as Array<Record<string, unknown>>) {
      hotspots.push({
        id: str(item.id),
        title: str(item.title),
        summary: strOrNull(item.summary),
        originalUrl: strOrNull(item.originalUrl),
        discussionUrl: strOrNull(item.discussionUrl),
        author: strOrNull(item.author),
        source: str(item.source),
        sourceLabel: SOURCE_LABELS[str(item.source)] ?? str(item.source),
        publishedAt: strOrNull(item.publishedAt),
        score: num(item.score),
        commentCount: num(item.commentCount),
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
      });
    }
  }

  // Map GitHub repos
  const githubRepos: GitHubDailyItem[] = [];
  if (githubFile && Array.isArray(githubFile.repos)) {
    for (const item of githubFile.repos as Array<Record<string, unknown>>) {
      const meta = (item.metadataJson ?? {}) as Record<string, unknown>;
      const release = (meta.release ?? {}) as Record<string, unknown>;
      githubRepos.push({
        id: str(item.id),
        fullName: str(meta.fullName ?? item.title),
        owner: str(meta.owner),
        name: str(meta.name),
        description: strOrNull(item.summary),
        htmlUrl: str(item.originalUrl),
        primaryLanguage: strOrNull(meta.primaryLanguage),
        topics: Array.isArray(meta.topics) ? (meta.topics as string[]) : [],
        stars: num(item.score),
        starDelta24h: typeof meta.starDelta24h === "number" ? (meta.starDelta24h as number) : null,
        forks: num(item.commentCount),
        license: strOrNull(meta.license),
        pushedAt: strOrNull(meta.pushedAt),
        latestReleaseTag: strOrNull(release.latestReleaseTag),
        isFirstDay: Boolean(meta.isFirstDay),
        reasons: Array.isArray(meta.reasons) ? (meta.reasons as string[]) : [],
      });
    }
  }

  // Available dates (last 7 days)
  const availableDates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - i);
    availableDates.push(d.toISOString().slice(0, 10));
  }

  return {
    hotspots,
    githubRepos,
    selectedDate: dateKey,
    availableDates,
    hotspotCount: hotspots.length,
    githubCount: githubRepos.length,
    generatedAt: hotspotFile?.generatedAt as string ?? githubFile?.generatedAt as string ?? null,
    hotspotGeneratedAt: hotspotFile?.generatedAt as string ?? null,
    githubGeneratedAt: githubFile?.generatedAt as string ?? null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return fallback;
}

function strOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return fallback;
}
