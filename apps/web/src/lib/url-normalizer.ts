/**
 * URL Normalization Utility — Common dedup rules for article/hotspot providers.
 *
 * Normalizes URLs for deduplication purposes only. Does NOT modify stored URLs.
 *
 * Rules:
 * - Remove common tracking params (utm_*, fbclid, ref, etc.)
 * - Remove fragment (#...)
 * - Normalize trailing slash
 * - Lowercase host
 * - Does NOT merge different content pages
 *
 * @module url-normalizer
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "ref",
  "ref_src",
  "source",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
]);

/**
 * Normalize a URL for dedup comparison.
 * Does NOT modify the URL to a degree that would merge different content pages.
 */
export function normalizeUrlForDedup(raw: string): string | null {
  if (!raw) return null;

  let url: string;
  try {
    // If no protocol, try prepending https://
    if (!/^https?:\/\//i.test(raw)) {
      url = "https://" + raw;
    } else {
      url = raw;
    }
    const parsed = new URL(url);
    return normalizeParsedUrl(parsed);
  } catch {
    // Not a valid URL — return trimmed version
    return raw.trim().toLowerCase();
  }
}

function normalizeParsedUrl(parsed: URL): string {
  // Lowercase host
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove tracking params
  const searchParams = new URLSearchParams(parsed.search);
  let changed = false;
  for (const key of [...searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      searchParams.delete(key);
      changed = true;
    }
  }

  // Rebuild search string without tracking params
  if (changed) {
    const newSearch = searchParams.toString();
    parsed.search = newSearch ? `?${newSearch}` : "";
  }

  // Remove fragment
  parsed.hash = "";

  // Normalize trailing slash
  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (pathname === "") {
    pathname = "/";
  }
  parsed.pathname = pathname;

  return parsed.toString();
}

/**
 * Build a dedup key from multiple signals.
 * Returns null if no usable key can be constructed.
 */
export function buildDedupKey(params: {
  source: string;
  externalId: string;
  originalUrl?: string | null;
  title?: string;
}): string | null {
  // Priority 1: source + externalId
  if (params.source && params.externalId) {
    return `${params.source}:${params.externalId}`;
  }

  // Priority 2: normalized URL
  if (params.originalUrl) {
    const normalized = normalizeUrlForDedup(params.originalUrl);
    if (normalized) return `url:${normalized}`;
  }

  // Priority 3: normalized title (fallback only)
  if (params.title) {
    const normalizedTitle = params.title.trim().toLowerCase().slice(0, 80);
    if (normalizedTitle) return `title:${normalizedTitle}`;
  }

  return null;
}

/**
 * Find duplicate entries using dedup keys.
 * Returns a map from the canonical key to the primary entry index.
 */
export function deduplicateByKey<T>(
  items: T[],
  keyFn: (item: T) => string | null,
): Map<string, number> {
  const seen = new Map<string, number>();
  for (let i = 0; i < items.length; i += 1) {
    const key = keyFn(items[i]);
    if (key && !seen.has(key)) {
      seen.set(key, i);
    }
  }
  return seen;
}
