/**
 * GitHub Daily Report Sync Service
 *
 * Generates daily snapshots of trending GitHub repositories using the
 * public GitHub REST API. Computes star delta from prior day snapshots.
 *
 * Rules:
 * - Default: sync once per day
 * - No README content fetched or stored
 * - GITHUB_TOKEN is optional and server-only
 * - First day shows no star delta (no prior snapshot)
 * - Archived and forks are excluded at fetch time
 * - Deterministic ranking (no LLM)
 *
 * @module github-daily-report-sync
 */

import {
  fetchGitHubCandidates,
  fetchReleasesForTop,
  type GitHubRepoResult,
  type GitHubRepoWithRelease,
} from "./github-provider.ts";
import type { DailyContentRepository, DailyContentUpsertInput } from "./daily-tech-hotspot-sync.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubSyncResult {
  success: boolean;
  date: string;
  fetched: number;
  afterFilter: number;
  withStarDelta: number;
  saved: number;
  isFirstDay: boolean;
  errors: string[];
  lastedMs: number;
}

export interface GitHubSyncStatus {
  lastSyncAt: string | null;
  lastSyncDate: string | null;
  lastSyncResult: GitHubSyncResult | null;
  canRefresh: boolean;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const MIN_REFRESH_MS = 23 * 60 * 60 * 1000; // ~1 day
const syncState = new Map<string, { lastSyncAt: Date }>();

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Sync the GitHub daily report for a given date.
 */
export async function syncGitHubDailyReport(
  date: Date,
  repository: DailyContentRepository,
): Promise<GitHubSyncResult> {
  const startedAt = Date.now();
  const dateKey = date.toISOString().slice(0, 10);
  const errors: string[] = [];

  // Check cooldown
  const state = syncState.get(dateKey);
  if (state && Date.now() - state.lastSyncAt.getTime() < MIN_REFRESH_MS) {
    return {
      success: true,
      date: dateKey,
      fetched: 0,
      afterFilter: 0,
      withStarDelta: 0,
      saved: 0,
      isFirstDay: false,
      errors: ["Sync skipped — within daily cooldown"],
      lastedMs: Date.now() - startedAt,
    };
  }

  // Fetch from GitHub
  let reposWithRelease: GitHubRepoWithRelease[] = [];
  try {
    const candidates = await fetchGitHubCandidates();
    reposWithRelease = await fetchReleasesForTop(candidates, 10);
  } catch (err) {
    errors.push(`GitHub fetch failed: ${String(err)}`);
    return {
      success: false,
      date: dateKey,
      fetched: 0,
      afterFilter: 0,
      withStarDelta: 0,
      saved: 0,
      isFirstDay: false,
      errors,
      lastedMs: Date.now() - startedAt,
    };
  }

  // Compute star delta from yesterday's snapshot
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayItems = (await repository.getByDate(yesterday, "GITHUB_REPOSITORY"))
    .filter(isDailyContentSnapshotRecord);
  const yesterdayStarMap = new Map<string, number>();
  for (const item of yesterdayItems) {
    const key = `${item.source}:${item.externalId}`;
    const prevStars = readMetadataStars(item.metadataJson) ?? item.score ?? 0;
    yesterdayStarMap.set(key, prevStars);
  }

  const isFirstDay = yesterdayItems.length === 0;

  // Compute deltas and build upsert inputs
  const inputs: DailyContentUpsertInput[] = [];
  let withDelta = 0;

  for (const repo of reposWithRelease) {
    const prevStars = yesterdayStarMap.get(`github:${repo.repositoryId}`);
    const starDelta =
      prevStars !== undefined ? repo.stars - prevStars : null;

    if (starDelta !== null) withDelta += 1;

    // Build deterministic reason
    const reasons: string[] = [];
    if (!isFirstDay && starDelta !== null && starDelta > 0) {
      reasons.push(`24h ⭐ +${starDelta}`);
    }
    if (repo.release?.latestReleaseTag && !repo.release?.prerelease) {
      reasons.push(`新 Release ${repo.release.latestReleaseTag}`);
    }
    const daysSinceCreated = Math.floor(
      (Date.now() - repo.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysSinceCreated <= 7) {
      reasons.push(`${daysSinceCreated}天前新建`);
    }

    const desc = repo.description ?? "";

    inputs.push({
      kind: "GITHUB_REPOSITORY",
      source: "github",
      externalId: String(repo.repositoryId),
      title: `${repo.fullName}`,
      summary: desc,
      originalUrl: repo.htmlUrl,
      discussionUrl: null,
      author: repo.owner,
      publishedAt: repo.createdAt,
      dailyDate: date,
      score: repo.stars,
      commentCount: repo.forks,
      metadataJson: {
        fullName: repo.fullName,
        owner: repo.owner,
        name: repo.name,
        description: desc,
        homepage: repo.homepage,
        primaryLanguage: repo.primaryLanguage,
        topics: repo.topics,
        stars: repo.stars,
        forks: repo.forks,
        openIssues: repo.openIssues,
        license: repo.license,
        createdAt: repo.createdAt.toISOString(),
        updatedAt: repo.updatedAt.toISOString(),
        pushedAt: repo.pushedAt.toISOString(),
        starDelta24h: starDelta,
        isFirstDay,
        reasons,
        release: repo.release
          ? {
              latestReleaseTag: repo.release.latestReleaseTag,
              latestReleaseName: repo.release.latestReleaseName,
              latestReleaseUrl: repo.release.latestReleaseUrl,
              latestReleasePublishedAt:
                repo.release.latestReleasePublishedAt?.toISOString() ?? null,
              prerelease: repo.release.prerelease,
              draft: repo.release.draft,
            }
          : null,
        fetchedAt: new Date().toISOString(),
      },
    });
  }

  // Save to database
  let saved = 0;
  try {
    saved = await repository.upsertMany(inputs);
  } catch (err) {
    errors.push(`DB save failed: ${String(err)}`);
  }

  syncState.set(dateKey, { lastSyncAt: new Date() });

  return {
    success: saved > 0 || errors.length === 0,
    date: dateKey,
    fetched: reposWithRelease.length,
    afterFilter: inputs.length,
    withStarDelta: withDelta,
    saved,
    isFirstDay,
    errors,
    lastedMs: Date.now() - startedAt,
  };
}

function readMetadataStars(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const stars = (metadata as Record<string, unknown>).stars;
  return typeof stars === "number" && Number.isFinite(stars) ? stars : null;
}

interface DailyContentSnapshotRecord {
  source: string;
  externalId: string;
  score: number | null;
  metadataJson: unknown;
}

function isDailyContentSnapshotRecord(value: unknown): value is DailyContentSnapshotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.source === "string" &&
    typeof record.externalId === "string" &&
    (typeof record.score === "number" || record.score === null) &&
    "metadataJson" in record
  );
}

/**
 * Get sync status for the GitHub daily report.
 */
export function getGitHubSyncStatus(
  lastSyncResult: GitHubSyncResult | null,
): GitHubSyncStatus {
  const dateKey = new Date().toISOString().slice(0, 10);
  const state = syncState.get(dateKey);
  const lastSyncAt = state?.lastSyncAt ?? null;
  const canRefresh = !state;

  return {
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    lastSyncDate: dateKey,
    lastSyncResult,
    canRefresh,
  };
}

/**
 * Determine if the GitHub daily report needs a refresh.
 */
export function shouldRefreshGitHub(date: Date): boolean {
  const dateKey = date.toISOString().slice(0, 10);
  const state = syncState.get(dateKey);
  if (!state) return true;
  return Date.now() - state.lastSyncAt.getTime() >= MIN_REFRESH_MS;
}
