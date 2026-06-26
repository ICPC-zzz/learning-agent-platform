/**
 * Local user library store - favorites & recent reading.
 *
 * Uses browser localStorage for persistence. All data is local-only.
 *
 * A376: Added session-aware labeling helpers. Data still stays in localStorage.
 *
 * @module local-user-library-store
 * @previewOnly
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteBookEntry {
  bookId: string;
  title: string;
  sourceType: string;
  firstChapterId?: string;
  updatedAt: string;
}

export interface RecentReadingEntry {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  sourceType: string;
  lastReadAt: string;
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const FAVORITES_KEY = "lap.web.user.favoriteBooks";
const RECENT_READING_KEY = "lap.web.user.recentReading";

// ---------------------------------------------------------------------------
// Sensitive field patterns
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bcertificate\b/i,
  /\bauthorization\b/i,
];

// ---------------------------------------------------------------------------
// Pure functions - favorites
// ---------------------------------------------------------------------------

export function isFavorite(
  favorites: readonly FavoriteBookEntry[],
  bookId: string,
): boolean {
  return favorites.some((f) => f.bookId === bookId);
}

export function addFavorite(
  favorites: readonly FavoriteBookEntry[],
  entry: FavoriteBookEntry,
): FavoriteBookEntry[] {
  if (isFavorite(favorites, entry.bookId)) {
    return [...favorites];
  }
  return [entry, ...favorites];
}

export function removeFavorite(
  favorites: readonly FavoriteBookEntry[],
  bookId: string,
): FavoriteBookEntry[] {
  return favorites.filter((f) => f.bookId !== bookId);
}

// ---------------------------------------------------------------------------
// Pure functions - recent reading
// ---------------------------------------------------------------------------

export function addRecentReading(
  entries: readonly RecentReadingEntry[],
  entry: RecentReadingEntry,
): RecentReadingEntry[] {
  const filtered = entries.filter(
    (e) => !(e.bookId === entry.bookId && e.chapterId === entry.chapterId),
  );
  return [entry, ...filtered];
}

export function getRecentReadings(
  entries: readonly RecentReadingEntry[],
  limit: number = 10,
): RecentReadingEntry[] {
  return entries.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function hasSensitiveFields(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}

export function isValidFavoriteEntry(entry: unknown): entry is FavoriteBookEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.bookId !== "string" || e.bookId.length === 0) return false;
  if (typeof e.title !== "string") return false;
  if (typeof e.sourceType !== "string") return false;
  if (typeof e.updatedAt !== "string") return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

export function isValidRecentReadingEntry(
  entry: unknown,
): entry is RecentReadingEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.bookId !== "string" || e.bookId.length === 0) return false;
  if (typeof e.chapterId !== "string" || e.chapterId.length === 0) return false;
  if (typeof e.bookTitle !== "string") return false;
  if (typeof e.chapterTitle !== "string") return false;
  if (typeof e.sourceType !== "string") return false;
  if (typeof e.lastReadAt !== "string") return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// localStorage read/write
// ---------------------------------------------------------------------------

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

export function loadFavorites(): FavoriteBookEntry[] {
  const raw = safeGetItem(FAVORITES_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(FAVORITES_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(FAVORITES_KEY);
    return [];
  }
  return parsed.filter(isValidFavoriteEntry);
}

export function loadFavoriteBooks(): FavoriteBookEntry[] {
  return loadFavorites();
}

export function persistFavorites(favorites: readonly FavoriteBookEntry[]): boolean {
  const safe = favorites.filter(isValidFavoriteEntry);
  return safeSetItem(FAVORITES_KEY, JSON.stringify(safe));
}

export function loadRecentReadings(): RecentReadingEntry[] {
  const raw = safeGetItem(RECENT_READING_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(RECENT_READING_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(RECENT_READING_KEY);
    return [];
  }
  return parsed.filter(isValidRecentReadingEntry);
}

export function persistRecentReadings(
  entries: readonly RecentReadingEntry[],
): boolean {
  const safe = entries.filter(isValidRecentReadingEntry);
  return safeSetItem(RECENT_READING_KEY, JSON.stringify(safe));
}

// ---------------------------------------------------------------------------
// Session-aware UI labeling (A376)
// ---------------------------------------------------------------------------

export type SessionLabelMode = "no-session" | "dev-session";

export interface SessionAwareLabels {
  favoritesLabel: string;
  recentReadingLabel: string;
  localDataNotice: string;
}

export function getSessionAwareLabels(mode: SessionLabelMode): SessionAwareLabels {
  if (mode === "dev-session") {
    return {
      favoritesLabel: "Favorite Books (local, not synced)",
      recentReadingLabel: "Recent Reading (local, not synced)",
      localDataNotice:
        "Dev session active. Favorites and recent reading are in local browser storage, not synced to account.",
    };
  }
  return {
    favoritesLabel: "Favorite Books (local)",
    recentReadingLabel: "Recent Reading (local)",
    localDataNotice:
      "Data saved in local browser only. Not logged in, not synced to database.",
  };
}
