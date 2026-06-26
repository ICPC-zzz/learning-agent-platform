/**
 * Daily Content Loader — Article Center DB-backed data fetching.
 *
 * Loads daily tech hotspots and GitHub repository reports from the database
 * for the article center page. Used alongside the existing JSON-file-based
 * blog园/CSDN article loader.
 *
 * @module daily-content-loader
 */

import type { DailyContentRepository, DailyContentRecord } from "@learning-agent-platform/db";

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
}

// ---------------------------------------------------------------------------
// Source label mapping
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  hackernews: "Hacker News",
  forem: "DEV Community",
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load daily content for a specific date from the database.
 */
export async function loadDailyContent(
  date: Date,
  repository: DailyContentRepository,
): Promise<DailyContentPageData> {
  const dateKey = date.toISOString().slice(0, 10);

  // Load hotspots
  const hotspotRecords = await repository.getByDate(date, "TECH_HOTSPOT");
  const hotspots = hotspotRecords.map(mapHotspotRecord);

  // Load GitHub repos
  const githubRecords = await repository.getByDate(date, "GITHUB_REPOSITORY");
  const githubRepos = githubRecords.map(mapGitHubRecord);

  // Build available dates (last 7 days)
  const availableDates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(date);
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
  };
}

/**
 * Load the latest snapshot date for a kind.
 */
export async function loadLatestSnapshotDate(
  kind: "TECH_HOTSPOT" | "GITHUB_REPOSITORY",
  repository: DailyContentRepository,
): Promise<string | null> {
  const date = await repository.getLatestDate(kind);
  return date ? date.toISOString().slice(0, 10) : null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapHotspotRecord(record: DailyContentRecord): DailyHotspotItem {
  const meta = (record.metadataJson ?? {}) as Record<string, unknown>;
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    originalUrl: record.originalUrl,
    discussionUrl: record.discussionUrl,
    author: record.author,
    source: record.source,
    sourceLabel: SOURCE_LABELS[record.source] ?? record.source,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    score: record.score ?? 0,
    commentCount: record.commentCount ?? 0,
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
  };
}

function mapGitHubRecord(record: DailyContentRecord): GitHubDailyItem {
  const meta = (record.metadataJson ?? {}) as Record<string, unknown>;
  return {
    id: record.id,
    fullName: (meta.fullName as string) ?? record.title,
    owner: (meta.owner as string) ?? "",
    name: (meta.name as string) ?? "",
    description: record.summary,
    htmlUrl: record.originalUrl ?? "",
    primaryLanguage: (meta.primaryLanguage as string) ?? null,
    topics: Array.isArray(meta.topics) ? (meta.topics as string[]) : [],
    stars: record.score ?? 0,
    starDelta24h:
      typeof meta.starDelta24h === "number"
        ? (meta.starDelta24h as number)
        : null,
    forks: record.commentCount ?? 0,
    license: (meta.license as string) ?? null,
    pushedAt: (meta.pushedAt as string) ?? null,
    latestReleaseTag:
      (meta.release as Record<string, unknown>)?.latestReleaseTag as
        | string
        | null ?? null,
    isFirstDay: Boolean(meta.isFirstDay),
    reasons: Array.isArray(meta.reasons) ? (meta.reasons as string[]) : [],
  };
}
