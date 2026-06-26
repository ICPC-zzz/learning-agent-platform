/**
 * Daily Tech Hotspot Sync Service
 *
 * Orchestrates fetching, deduplication, and persistence of daily tech hotspots
 * from Hacker News and DEV.to (Forem).
 *
 * Rules:
 * - Max refresh every 6 hours per date
 * - API failures retain previous data
 * - No full text saved
 * - No LLM calls
 * - Idempotent (upsert by unique key)
 *
 * @module daily-tech-hotspot-sync
 */

import { fetchHackerNewsHotspots, type HackerNewsStory } from "./hackernews-provider.ts";
import { fetchForemArticles, type ForemArticle } from "./forem-provider.ts";
import { normalizeUrlForDedup } from "./url-normalizer.ts";

// Inline types (avoid @learning-agent-platform/db import to prevent
// Prisma engine bundling issue in Next.js Server Components)
export interface DailyContentUpsertInput {
  kind: "TECH_HOTSPOT" | "GITHUB_REPOSITORY";
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

export interface DailyContentRepository {
  upsertMany(inputs: DailyContentUpsertInput[]): Promise<number>;
  getByDate(date: Date, kind: string): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HotspotSyncResult {
  success: boolean;
  date: string;
  totalFetched: number;
  hnCount: number;
  foremCount: number;
  afterDedup: number;
  saved: number;
  errors: string[];
  lastedMs: number;
}

export interface HotspotSyncStatus {
  lastSyncAt: string | null;
  lastSyncDate: string | null;
  lastSyncResult: HotspotSyncResult | null;
  canRefresh: boolean;
  nextRefreshAt: string | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const MIN_REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours
const syncState = new Map<string, { lastSyncAt: Date }>();

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Sync daily tech hotspots for a given date.
 * Returns cached result if synced within the last 6 hours.
 */
export async function syncDailyTechHotspots(
  date: Date,
  repository: DailyContentRepository,
): Promise<HotspotSyncResult> {
  const startedAt = Date.now();
  const dateKey = date.toISOString().slice(0, 10);
  const errors: string[] = [];

  // Check cooldown
  const state = syncState.get(dateKey);
  if (state && Date.now() - state.lastSyncAt.getTime() < MIN_REFRESH_MS) {
    return {
      success: true,
      date: dateKey,
      totalFetched: 0,
      hnCount: 0,
      foremCount: 0,
      afterDedup: 0,
      saved: 0,
      errors: ["Sync skipped — within 6-hour cooldown"],
      lastedMs: Date.now() - startedAt,
    };
  }

  // Fetch from all sources
  const [hnStories, foremArticles] = await Promise.allSettled([
    fetchHackerNewsHotspots(),
    fetchForemArticles(),
  ]);

  let allItems: DailyContentUpsertInput[] = [];
  let hnCount = 0;
  let foremCount = 0;

  // Process HN
  if (hnStories.status === "fulfilled") {
    hnCount = hnStories.value.length;
    for (const story of hnStories.value) {
      allItems.push(normalizeHnStory(story, date));
    }
  } else {
    errors.push(`HN fetch failed: ${String(hnStories.reason)}`);
  }

  // Process Forem
  if (foremArticles.status === "fulfilled") {
    foremCount = foremArticles.value.length;
    for (const article of foremArticles.value) {
      allItems.push(normalizeForemArticle(article, date));
    }
  } else {
    errors.push(`Forem fetch failed: ${String(foremArticles.reason)}`);
  }

  // Exit early if everything failed
  if (allItems.length === 0 && errors.length > 0) {
    return {
      success: false,
      date: dateKey,
      totalFetched: 0,
      hnCount,
      foremCount,
      afterDedup: 0,
      saved: 0,
      errors,
      lastedMs: Date.now() - startedAt,
    };
  }

  // Deduplicate: HN + Forem may have same content
  const deduped = deduplicateItems(allItems);
  const afterDedup = deduped.length;

  // Save to database
  let saved = 0;
  try {
    saved = await repository.upsertMany(deduped);
  } catch (err) {
    errors.push(`DB save failed: ${String(err)}`);
  }

  // Update sync state
  syncState.set(dateKey, { lastSyncAt: new Date() });

  return {
    success: saved > 0 || errors.length === 0,
    date: dateKey,
    totalFetched: hnCount + foremCount,
    hnCount,
    foremCount,
    afterDedup,
    saved,
    errors,
    lastedMs: Date.now() - startedAt,
  };
}

/**
 * Get the current sync status for the daily tech hotspot feed.
 */
export function getHotspotSyncStatus(
  lastSyncResult: HotspotSyncResult | null,
): HotspotSyncStatus {
  const dateKey = new Date().toISOString().slice(0, 10);
  const state = syncState.get(dateKey);
  const lastSyncAt = state?.lastSyncAt ?? null;
  const canRefresh = !state || Date.now() - state.lastSyncAt.getTime() >= MIN_REFRESH_MS;
  const nextRefreshAt = state
    ? new Date(state.lastSyncAt.getTime() + MIN_REFRESH_MS).toISOString()
    : null;

  return {
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    lastSyncDate: dateKey,
    lastSyncResult,
    canRefresh,
    nextRefreshAt,
  };
}

/**
 * Determine if the daily content needs a refresh for a given date.
 */
export function shouldRefreshHotspots(date: Date): boolean {
  const dateKey = date.toISOString().slice(0, 10);
  const state = syncState.get(dateKey);
  if (!state) return true;
  return Date.now() - state.lastSyncAt.getTime() >= MIN_REFRESH_MS;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeHnStory(
  story: HackerNewsStory,
  date: Date,
): DailyContentUpsertInput {
  return {
    kind: "TECH_HOTSPOT",
    source: "hackernews",
    externalId: story.externalId,
    title: story.title,
    summary: null,
    originalUrl: story.originalUrl,
    discussionUrl: story.discussionUrl,
    author: story.author,
    publishedAt: story.publishedAt,
    dailyDate: date,
    score: story.score,
    commentCount: story.commentCount,
    metadataJson: {
      type: story.type,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function normalizeForemArticle(
  article: ForemArticle,
  date: Date,
): DailyContentUpsertInput {
  return {
    kind: "TECH_HOTSPOT",
    source: "forem",
    externalId: article.externalId,
    title: article.title,
    summary: article.description,
    originalUrl: article.canonicalUrl,
    discussionUrl: null,
    author: article.author,
    publishedAt: article.publishedAt,
    dailyDate: date,
    score: article.positiveReactionsCount,
    commentCount: article.commentsCount,
    metadataJson: {
      tags: article.tags,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicateItems(
  items: DailyContentUpsertInput[],
): DailyContentUpsertInput[] {
  const seen = new Set<string>();
  const result: DailyContentUpsertInput[] = [];

  for (const item of items) {
    // Build dedup key from canonical URL first, then source+externalId
    const urlKey = item.originalUrl
      ? normalizeUrlForDedup(item.originalUrl)
      : null;

    const sourceKey = `${item.source}:${item.externalId}`;

    if (urlKey && seen.has(urlKey)) continue;
    if (seen.has(sourceKey)) continue;

    if (urlKey) seen.add(urlKey);
    seen.add(sourceKey);

    result.push(item);
  }

  return result;
}
