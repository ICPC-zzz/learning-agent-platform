/**
 * Local user article store - favorite articles and recent article reads.
 *
 * Uses browser localStorage for persistence. All data is local-only.
 */

export interface FavoriteArticleEntry {
  articleId: string;
  title: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  updatedAt: string;
}

export interface RecentArticleReadingEntry {
  articleId: string;
  title: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  lastReadAt: string;
}

const FAVORITE_ARTICLES_KEY = "lap.web.user.favoriteArticles";
const RECENT_ARTICLE_READING_KEY = "lap.web.user.recentArticleReading";
export const RECENT_ARTICLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bcertificate\b/i,
  /\bauthorization\b/i,
];

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeGetItem(key: string): string | null {
  if (!isClient()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (!isClient()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  if (!isClient()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function hasSensitiveFields(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(json));
}

export function isFavoriteArticle(
  entries: readonly FavoriteArticleEntry[],
  articleId: string,
): boolean {
  return entries.some((entry) => entry.articleId === articleId);
}

export function addFavoriteArticle(
  entries: readonly FavoriteArticleEntry[],
  entry: FavoriteArticleEntry,
): FavoriteArticleEntry[] {
  if (isFavoriteArticle(entries, entry.articleId)) {
    return [...entries];
  }
  return [entry, ...entries];
}

export function removeFavoriteArticle(
  entries: readonly FavoriteArticleEntry[],
  articleId: string,
): FavoriteArticleEntry[] {
  return entries.filter((entry) => entry.articleId !== articleId);
}

export function loadFavoriteArticles(): FavoriteArticleEntry[] {
  const raw = safeGetItem(FAVORITE_ARTICLES_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(FAVORITE_ARTICLES_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(FAVORITE_ARTICLES_KEY);
    return [];
  }
  return parsed.filter(isValidFavoriteArticleEntry);
}

export function persistFavoriteArticles(
  entries: readonly FavoriteArticleEntry[],
): boolean {
  const safe = entries.filter(isValidFavoriteArticleEntry);
  return safeSetItem(FAVORITE_ARTICLES_KEY, JSON.stringify(safe));
}

export function isValidFavoriteArticleEntry(
  entry: unknown,
): entry is FavoriteArticleEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const value = entry as Record<string, unknown>;
  if (typeof value.articleId !== "string" || value.articleId.length === 0) return false;
  if (typeof value.title !== "string") return false;
  if (typeof value.sourcePlatform !== "string") return false;
  if (typeof value.sourceName !== "string") return false;
  if (typeof value.originalUrl !== "string") return false;
  if (typeof value.updatedAt !== "string") return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

export function addRecentArticleReading(
  entries: readonly RecentArticleReadingEntry[],
  entry: RecentArticleReadingEntry,
): RecentArticleReadingEntry[] {
  const filtered = pruneRecentArticleReadings(entries).filter((item) => item.articleId !== entry.articleId);
  return [entry, ...filtered];
}

export function markArticleRead(
  entries: readonly RecentArticleReadingEntry[],
  entry: RecentArticleReadingEntry,
): RecentArticleReadingEntry[] {
  return addRecentArticleReading(entries, entry);
}

export function getRecentArticleReadings(
  entries: readonly RecentArticleReadingEntry[],
  limit: number = 15,
): RecentArticleReadingEntry[] {
  return pruneRecentArticleReadings(entries).slice(0, limit);
}

export function loadRecentArticleReadings(): RecentArticleReadingEntry[] {
  const raw = safeGetItem(RECENT_ARTICLE_READING_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(RECENT_ARTICLE_READING_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(RECENT_ARTICLE_READING_KEY);
    return [];
  }
  const fresh = parsed.filter(isValidRecentArticleReadingEntry).filter(isRecentArticleReadingFresh);
  if (fresh.length !== parsed.length) {
    persistRecentArticleReadings(fresh);
  }
  return fresh;
}

export function persistRecentArticleReadings(
  entries: readonly RecentArticleReadingEntry[],
): boolean {
  const safe = pruneRecentArticleReadings(entries);
  return safeSetItem(RECENT_ARTICLE_READING_KEY, JSON.stringify(safe));
}

export function isValidRecentArticleReadingEntry(
  entry: unknown,
): entry is RecentArticleReadingEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const value = entry as Record<string, unknown>;
  if (typeof value.articleId !== "string" || value.articleId.length === 0) return false;
  if (typeof value.title !== "string") return false;
  if (typeof value.sourcePlatform !== "string") return false;
  if (typeof value.sourceName !== "string") return false;
  if (typeof value.originalUrl !== "string") return false;
  if (typeof value.lastReadAt !== "string") return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

function pruneRecentArticleReadings(
  entries: readonly RecentArticleReadingEntry[],
): RecentArticleReadingEntry[] {
  return entries
    .filter(isValidRecentArticleReadingEntry)
    .filter(isRecentArticleReadingFresh);
}

function isRecentArticleReadingFresh(entry: RecentArticleReadingEntry): boolean {
  const at = Date.parse(entry.lastReadAt);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at <= RECENT_ARTICLE_RETENTION_MS;
}
