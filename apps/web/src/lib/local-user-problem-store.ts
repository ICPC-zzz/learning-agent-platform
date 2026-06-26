/**
 * Local user problem store — favorites & recent practice.
 *
 * Uses browser localStorage for persistence. All data is local-only.
 *
 * @module local-user-problem-store
 * @previewOnly — dev-only; not connected to real auth or DB
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PracticeStatus =
  | "not-started"
  | "practiced"
  | "completed"
  | "needs-review";

export interface FavoriteProblemEntry {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  favoritedAt: string;
}

export interface RecentPracticeEntry {
  problemId: string;
  title: string;
  difficulty: string;
  status: PracticeStatus;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const FAVORITE_PROBLEMS_KEY = "lap.web.user.favoriteProblems";
const RECENT_PRACTICE_KEY = "lap.web.user.recentPractice";

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
  /\brawText\b/i,
  /\braw[_\s]*prompt\b/i,
  /\braw[_\s]*response\b/i,
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function hasSensitiveFieldsInternal(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "not-started",
  "practiced",
  "completed",
  "needs-review",
]);

export function isValidPracticeStatus(s: unknown): s is PracticeStatus {
  return typeof s === "string" && VALID_STATUSES.has(s);
}

export function isValidFavoriteProblemEntry(
  entry: unknown,
): entry is FavoriteProblemEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.problemId !== "string" || e.problemId.length === 0) return false;
  if (typeof e.title !== "string") return false;
  if (typeof e.difficulty !== "string") return false;
  if (!Array.isArray(e.tags)) return false;
  if (typeof e.favoritedAt !== "string") return false;
  if (hasSensitiveFieldsInternal(entry)) return false;
  return true;
}

export function isValidRecentPracticeEntry(
  entry: unknown,
): entry is RecentPracticeEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.problemId !== "string" || e.problemId.length === 0) return false;
  if (typeof e.title !== "string") return false;
  if (typeof e.difficulty !== "string") return false;
  if (typeof e.status !== "string" || !VALID_STATUSES.has(e.status)) return false;
  if (typeof e.updatedAt !== "string") return false;
  if (hasSensitiveFieldsInternal(entry)) return false;
  return true;
}

export function hasSensitiveFields(obj: unknown): boolean {
  return hasSensitiveFieldsInternal(obj);
}

// ---------------------------------------------------------------------------
// Client-side detection
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

// ---------------------------------------------------------------------------
// Favorites — pure functions
// ---------------------------------------------------------------------------

export function isFavoriteProblem(
  favorites: readonly FavoriteProblemEntry[],
  problemId: string,
): boolean {
  return favorites.some((f) => f.problemId === problemId);
}

export function addFavoriteProblem(
  favorites: readonly FavoriteProblemEntry[],
  entry: FavoriteProblemEntry,
): FavoriteProblemEntry[] {
  if (isFavoriteProblem(favorites, entry.problemId)) {
    return [...favorites];
  }
  return [entry, ...favorites];
}

export function removeFavoriteProblem(
  favorites: readonly FavoriteProblemEntry[],
  problemId: string,
): FavoriteProblemEntry[] {
  return favorites.filter((f) => f.problemId !== problemId);
}

// ---------------------------------------------------------------------------
// Recent practice — pure functions
// ---------------------------------------------------------------------------

export function addRecentPractice(
  entries: readonly RecentPracticeEntry[],
  entry: RecentPracticeEntry,
): RecentPracticeEntry[] {
  const filtered = entries.filter((e) => e.problemId !== entry.problemId);
  return [entry, ...filtered];
}

export function updateRecentPracticeStatus(
  entries: readonly RecentPracticeEntry[],
  problemId: string,
  newStatus: PracticeStatus,
): RecentPracticeEntry[] {
  return entries.map((e) =>
    e.problemId === problemId ? { ...e, status: newStatus, updatedAt: new Date().toISOString() } : e,
  );
}

export function getRecentPractice(
  entries: readonly RecentPracticeEntry[],
  limit: number = 20,
): RecentPracticeEntry[] {
  return entries.slice(0, limit);
}

// ---------------------------------------------------------------------------
// localStorage read/write
// ---------------------------------------------------------------------------

export function loadFavorites(): FavoriteProblemEntry[] {
  const raw = safeGetItem(FAVORITE_PROBLEMS_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(FAVORITE_PROBLEMS_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(FAVORITE_PROBLEMS_KEY);
    return [];
  }
  return parsed.filter(isValidFavoriteProblemEntry);
}

export function loadFavoriteProblems(): FavoriteProblemEntry[] {
  return loadFavorites();
}

export function persistFavorites(
  favorites: readonly FavoriteProblemEntry[],
): boolean {
  const safe = favorites.filter(isValidFavoriteProblemEntry);
  return safeSetItem(FAVORITE_PROBLEMS_KEY, JSON.stringify(safe));
}

export function loadRecentPractice(): RecentPracticeEntry[] {
  const raw = safeGetItem(RECENT_PRACTICE_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(RECENT_PRACTICE_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(RECENT_PRACTICE_KEY);
    return [];
  }
  return parsed.filter(isValidRecentPracticeEntry);
}

export function persistRecentPractice(
  entries: readonly RecentPracticeEntry[],
): boolean {
  const safe = entries.filter(isValidRecentPracticeEntry);
  return safeSetItem(RECENT_PRACTICE_KEY, JSON.stringify(safe));
}
