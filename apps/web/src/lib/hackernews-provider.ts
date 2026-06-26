/**
 * Hacker News API Provider — Daily Tech Hotspots Source
 *
 * Fetches top/best stories from the official HN API, filters and normalizes
 * them for use in the daily tech hotspot feed.
 *
 * Rules:
 * - Only stores metadata (no comments, no full text)
 * - Filters non-story types (job, poll)
 * - Filters old content (>48h)
 * - Respects concurrency limits
 * - Does NOT call LLM
 *
 * @module hackernews-provider
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HackerNewsStory {
  externalId: string;
  title: string;
  originalUrl: string | null;
  discussionUrl: string;
  author: string;
  score: number;
  commentCount: number;
  publishedAt: Date;
  type: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const HN_BASE = "https://hacker-news.firebaseio.com/v0";
const HN_ITEM = "https://hacker-news.firebaseio.com/v0/item";
const MAX_CONCURRENT = 8;
const MAX_CANDIDATES = 80;
const STALE_HOURS = 48;

interface HnItem {
  id: number;
  type: string;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;
  time?: number;
  text?: string;
  deleted?: boolean;
  dead?: boolean;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch story IDs
// ---------------------------------------------------------------------------

export async function fetchTopStoryIds(): Promise<number[]> {
  const ids = await fetchJson<number[]>(`${HN_BASE}/topstories.json`);
  return ids ?? [];
}

export async function fetchBestStoryIds(): Promise<number[]> {
  const ids = await fetchJson<number[]>(`${HN_BASE}/beststories.json`);
  return ids ?? [];
}

// ---------------------------------------------------------------------------
// Fetch story details
// ---------------------------------------------------------------------------

export async function fetchStoryDetails(id: number): Promise<HnItem | null> {
  return fetchJson<HnItem>(`${HN_ITEM}/${id}.json`);
}

// ---------------------------------------------------------------------------
// Fetch and filter stories
// ---------------------------------------------------------------------------

/**
 * Fetch HN top + best stories, deduplicate, filter, and return normalized
 * stories for the daily hotspot feed.
 */
export async function fetchHackerNewsHotspots(): Promise<HackerNewsStory[]> {
  // Get candidate IDs from top and best
  const [topIds, bestIds] = await Promise.all([
    fetchTopStoryIds(),
    fetchBestStoryIds(),
  ]);

  // Merge and deduplicate
  const combined = [...new Set([...topIds, ...bestIds])];
  const candidates = combined.slice(0, MAX_CANDIDATES);

  // Fetch details with concurrency control
  const stories: HackerNewsStory[] = [];
  const now = Date.now();
  const staleCutoff = STALE_HOURS * 60 * 60 * 1000;

  // Batch fetch with concurrency limit
  for (let i = 0; i < candidates.length; i += MAX_CONCURRENT) {
    const batch = candidates.slice(i, i + MAX_CONCURRENT);
    const results = await Promise.all(
      batch.map((id) => fetchStoryDetails(id)),
    );

    for (const item of results) {
      if (!item) continue;

      // Filter: only stories
      if (item.type !== "story") continue;

      // Filter: not deleted or dead
      if (item.deleted || item.dead) continue;

      // Filter: must have a title
      if (!item.title || item.title.trim().length === 0) continue;

      // Filter: stale content
      const publishedAt = item.time ? new Date(item.time * 1000) : null;
      if (publishedAt && now - publishedAt.getTime() > staleCutoff) continue;

      // Must have at least one valid link
      const discussionUrl = `https://news.ycombinator.com/item?id=${item.id}`;

      stories.push({
        externalId: String(item.id),
        title: item.title.trim(),
        originalUrl: item.url?.trim() ?? null,
        discussionUrl,
        author: item.by ?? "unknown",
        score: item.score ?? 0,
        commentCount: item.descendants ?? 0,
        publishedAt: publishedAt ?? new Date(),
        type: "story",
      });
    }
  }

  // Sort by score descending, then by recency
  stories.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  // Return top ~25 stories
  return stories.slice(0, 25);
}
