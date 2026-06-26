/**
 * GitHub REST API Provider — GitHub Daily Report Source
 *
 * Uses the GitHub REST API to search for repositories by creation date,
 * activity, and topic. Supports optional GITHUB_TOKEN for higher rate limits.
 *
 * Rules:
 * - Optional GITHUB_TOKEN (server-side only, never sent to client)
 * - Falls back to anonymous requests when no token
 * - Excludes archived and forked repos
 * - Never fetches README content
 * - Uses repository search + release endpoint
 *
 * @module github-provider
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubRepoResult {
  repositoryId: number;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date;
  archived: boolean;
  fork: boolean;
}

export interface GitHubReleaseInfo {
  latestReleaseTag: string | null;
  latestReleaseName: string | null;
  latestReleaseUrl: string | null;
  latestReleasePublishedAt: Date | null;
  prerelease: boolean;
  draft: boolean;
}

export interface GitHubRepoWithRelease extends GitHubRepoResult {
  release: GitHubReleaseInfo;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";
const ANON_HEADERS = { Accept: "application/vnd.github.v3+json" };

function getToken(): string | undefined {
  // Server-side only — read from env, never logged or sent to client
  try {
    return process.env.GITHUB_TOKEN;
  } catch {
    return undefined;
  }
}

function buildHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { ...ANON_HEADERS, Authorization: `Bearer ${token}` }
    : ANON_HEADERS;
}

async function fetchGitHub<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: buildHeaders() });
    if (res.status === 403 || res.status === 429) {
      // Rate limited
      console.warn("GitHub API rate limited");
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Search types (GitHub REST API response shape)
// ---------------------------------------------------------------------------

interface GhSearchRepoItem {
  id: number;
  full_name: string;
  owner: { login: string };
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string } | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
}

interface GhSearchResponse {
  total_count: number;
  items: GhSearchRepoItem[];
}

interface GhRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

// ---------------------------------------------------------------------------
// Repository search queries
// ---------------------------------------------------------------------------

const TOPICS_OF_INTEREST = [
  "artificial-intelligence",
  "ai-agent",
  "developer-tools",
  "programming",
  "education",
  "algorithms",
  "open-source",
  "machine-learning",
  "llm",
  "data-structures",
];

/**
 * Fixed search queries for the GitHub daily report.
 * Each query is limited to stay within rate limits.
 */
const DAILY_QUERIES = [
  // New repos created in the last 7 days with min stars
  (date: string) =>
    `${GITHUB_API}/search/repositories?q=created:>${date}+stars:>=20&sort=stars&order=desc&per_page=15`,

  // Recently pushed repos with activity
  (date: string) =>
    `${GITHUB_API}/search/repositories?q=pushed:>${date}+stars:>=50&sort=updated&order=desc&per_page=10`,
];

/**
 * Build a topic-specific search query.
 */
function buildTopicQuery(topic: string, date: string): string {
  return `${GITHUB_API}/search/repositories?q=${encodeURIComponent(topic)}+stars:>=10+created:>${date}&sort=stars&order=desc&per_page=5`;
}

// ---------------------------------------------------------------------------
// Fetch repositories
// ---------------------------------------------------------------------------

/**
 * Fetch candidate repositories for the daily report.
 * Runs a limited number of search queries to stay within rate limits.
 */
export async function fetchGitHubCandidates(): Promise<GitHubRepoResult[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dateStr = sevenDaysAgo.toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const seen = new Set<number>();
  const repos: GitHubRepoResult[] = [];

  // Run fixed queries
  for (const queryFn of DAILY_QUERIES) {
    const url = queryFn(sevenDaysAgo === sevenDaysAgo ? dateStr : threeDaysAgo);
    const result = await fetchGitHub<GhSearchResponse>(url);
    if (!result) continue;

    for (const item of result.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      // Filter out archived and forks
      if (item.archived || item.fork) continue;

      // Filter: must have description or reasonable stars
      if (!item.description && item.stargazers_count < 10) continue;

      repos.push(normalizeRepoItem(item));
    }
  }

  // Run a few topic queries (limit to avoid rate limits)
  const topicSubset = TOPICS_OF_INTEREST.slice(0, 4);
  for (const topic of topicSubset) {
    const url = buildTopicQuery(topic, dateStr);
    const result = await fetchGitHub<GhSearchResponse>(url);
    if (!result) continue;

    for (const item of result.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      if (item.archived || item.fork) continue;

      repos.push(normalizeRepoItem(item));
    }
  }

  return repos;
}

/**
 * Fetch the latest release for a repository.
 */
export async function fetchLatestRelease(
  fullName: string,
): Promise<GitHubReleaseInfo> {
  const url = `${GITHUB_API}/repos/${fullName}/releases/latest`;
  const release = await fetchGitHub<GhRelease>(url);

  if (!release) {
    return {
      latestReleaseTag: null,
      latestReleaseName: null,
      latestReleaseUrl: null,
      latestReleasePublishedAt: null,
      prerelease: false,
      draft: false,
    };
  }

  return {
    latestReleaseTag: release.tag_name,
    latestReleaseName: release.name ?? release.tag_name,
    latestReleaseUrl: release.html_url,
    latestReleasePublishedAt: release.published_at
      ? new Date(release.published_at)
      : null,
    prerelease: release.prerelease,
    draft: release.draft,
  };
}

/**
 * Fetch releases for the top N repos to avoid excessive API calls.
 */
export async function fetchReleasesForTop(
  repos: GitHubRepoResult[],
  topN: number = 10,
): Promise<GitHubRepoWithRelease[]> {
  const withReleases: GitHubRepoWithRelease[] = [];

  for (let i = 0; i < repos.length; i += 1) {
    const repo = repos[i];
    if (i < topN) {
      const release = await fetchLatestRelease(repo.fullName);
      withReleases.push({ ...repo, release });
    } else {
      withReleases.push({
        ...repo,
        release: {
          latestReleaseTag: null,
          latestReleaseName: null,
          latestReleaseUrl: null,
          latestReleasePublishedAt: null,
          prerelease: false,
          draft: false,
        },
      });
    }
  }

  return withReleases;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeRepoItem(item: GhSearchRepoItem): GitHubRepoResult {
  return {
    repositoryId: item.id,
    fullName: item.full_name,
    owner: item.owner.login,
    name: item.name,
    description: item.description?.trim() ?? null,
    htmlUrl: item.html_url,
    homepage: item.homepage?.trim() ?? null,
    primaryLanguage: item.language?.trim() ?? null,
    topics: item.topics ?? [],
    stars: item.stargazers_count,
    forks: item.forks_count,
    openIssues: item.open_issues_count,
    license: item.license?.spdx_id ?? null,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
    pushedAt: new Date(item.pushed_at),
    archived: item.archived,
    fork: item.fork,
  };
}
