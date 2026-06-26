"use server";

/**
 * Daily Content Server Action — loads daily hotspots and GitHub repos
 * from the database for the article center page.
 *
 * Server-side only. Uses the same PrismaClient that all other server
 * actions in the project use.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

const SOURCE_LABELS: Record<string, string> = {
  hackernews: "Hacker News",
  forem: "DEV Community",
};

/**
 * Load daily content for a specific date from the database.
 */
export async function loadDailyContentServerAction(
  dateStr: string,
): Promise<DailyContentPageData | null> {
  const date = new Date(dateStr);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Load hotspots
    const hotspotRecords = await (prisma as any).dailyContentItem.findMany({
      where: { kind: "TECH_HOTSPOT", dailyDate: { gte: startOfDay, lte: endOfDay } },
      orderBy: [{ score: "desc" }, { commentCount: "desc" }],
      take: 100,
    });

    // Load GitHub repos
    const githubRecords = await (prisma as any).dailyContentItem.findMany({
      where: { kind: "GITHUB_REPOSITORY", dailyDate: { gte: startOfDay, lte: endOfDay } },
      orderBy: [{ score: "desc" }, { commentCount: "desc" }],
      take: 50,
    });

    if (hotspotRecords.length === 0 && githubRecords.length === 0) return null;

    const hotspots: DailyHotspotItem[] = hotspotRecords.map((r: any) => {
      const meta = r.metadataJson ?? {};
      return {
        id: r.id,
        title: r.title,
        summary: r.summary,
        originalUrl: r.originalUrl,
        discussionUrl: r.discussionUrl,
        author: r.author,
        source: r.source,
        sourceLabel: SOURCE_LABELS[r.source] ?? r.source,
        publishedAt: r.publishedAt?.toISOString?.() ?? null,
        score: r.score ?? 0,
        commentCount: r.commentCount ?? 0,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
      };
    });

    const githubRepos: GitHubDailyItem[] = githubRecords.map((r: any) => {
      const meta = r.metadataJson ?? {};
      return {
        id: r.id,
        fullName: meta.fullName ?? r.title,
        owner: meta.owner ?? "",
        name: meta.name ?? "",
        description: r.summary,
        htmlUrl: r.originalUrl ?? "",
        primaryLanguage: meta.primaryLanguage ?? null,
        topics: Array.isArray(meta.topics) ? meta.topics : [],
        stars: r.score ?? 0,
        starDelta24h: typeof meta.starDelta24h === "number" ? meta.starDelta24h : null,
        forks: r.commentCount ?? 0,
        license: meta.license ?? null,
        pushedAt: meta.pushedAt ?? null,
        latestReleaseTag: meta.release?.latestReleaseTag ?? null,
        isFirstDay: Boolean(meta.isFirstDay),
        reasons: Array.isArray(meta.reasons) ? meta.reasons : [],
      };
    });

    // Available dates (last 7 days)
    const availableDates: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      availableDates.push(d.toISOString().slice(0, 10));
    }

    return {
      hotspots,
      githubRepos,
      selectedDate: dateStr,
      availableDates,
      hotspotCount: hotspots.length,
      githubCount: githubRepos.length,
    };
  } catch {
    return null;
  }
}

/**
 * Load content for a specific date (used by date switcher).
 */
export async function loadDailyContentForDate(
  dateStr: string,
): Promise<DailyContentPageData | null> {
  return loadDailyContentServerAction(dateStr);
}
