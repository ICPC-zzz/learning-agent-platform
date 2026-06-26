/**
 * DEV.to / Forem API Provider — Daily Tech Hotspots Source
 *
 * Fetches popular public articles from DEV.to for use in the daily tech
 * hotspot feed. Uses the public articles endpoint.
 *
 * Rules:
 * - Only stores metadata (no full article body)
 * - Uses public API only
 * - Respects pagination limits
 * - Does NOT call LLM
 *
 * @module forem-provider
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForemArticle {
  externalId: string;
  title: string;
  description: string | null;
  canonicalUrl: string;
  author: string;
  publishedAt: Date;
  tags: string[];
  positiveReactionsCount: number;
  commentsCount: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const DEV_API_BASE = "https://dev.to/api";
const MAX_PAGES = 3;
const PER_PAGE = 20;

interface DevArticle {
  id: number;
  title: string;
  description: string;
  canonical_url: string;
  url: string;
  published_at: string;
  tag_list: string[];
  user: { name: string; username: string };
  positive_reactions_count: number;
  comments_count: number;
}

async function fetchDevJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch articles
// ---------------------------------------------------------------------------

/**
 * Fetch popular articles from DEV.to.
 * Returns up to ~60 articles (3 pages, 20 per page).
 */
export async function fetchForemArticles(): Promise<ForemArticle[]> {
  const articles: ForemArticle[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = `${DEV_API_BASE}/articles?page=${page + 1}&per_page=${PER_PAGE}&top=3`;
    const data = await fetchDevJson<DevArticle[]>(url);

    if (!data || data.length === 0) break;

    for (const item of data) {
      articles.push(normalizeDevArticle(item));
    }
  }

  return articles;
}

function normalizeDevArticle(item: DevArticle): ForemArticle {
  return {
    externalId: String(item.id),
    title: item.title?.trim() ?? "",
    description: item.description?.trim() ?? null,
    canonicalUrl: item.canonical_url ?? item.url,
    author: item.user?.name ?? item.user?.username ?? "unknown",
    publishedAt: item.published_at ? new Date(item.published_at) : new Date(),
    tags: item.tag_list?.slice(0, 5) ?? [],
    positiveReactionsCount: item.positive_reactions_count ?? 0,
    commentsCount: item.comments_count ?? 0,
  };
}
