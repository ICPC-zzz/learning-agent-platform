/**
 * Local Problem Wrong Book Store — localStorage-based wrong book data.
 *
 * Key: lap.web.user.problemWrongBook
 *
 * Stores wrong-problem entries with wrong count, review status,
 * error notes, and timestamps. All data is local-only.
 *
 * @module local-problem-wrong-book-store
 * @previewOnly — dev-only; not connected to real OJ or production auth
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WrongBookReviewStatus =
  | "needs-review"
  | "reviewed"
  | "mastered";

export interface WrongBookEntry {
  wrongBookId: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  wrongCount: number;
  lastWrongAt: string;
  reviewStatus: WrongBookReviewStatus;
  notePreview: string | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// localStorage key
// ---------------------------------------------------------------------------

const WRONG_BOOK_KEY = "lap.web.user.problemWrongBook";
const MAX_NOTE_LENGTH = 300;
const VALID_REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "needs-review",
  "reviewed",
  "mastered",
]);

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
  /\buserSubmittedCode\b/i,
  /\bsubmittedCode\b/i,
];

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
// Entry validation
// ---------------------------------------------------------------------------

export function isValidWrongBookEntry(
  entry: unknown,
): entry is WrongBookEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.wrongBookId !== "string" || e.wrongBookId.length === 0) return false;
  if (typeof e.problemId !== "string" || e.problemId.length === 0) return false;
  if (typeof e.title !== "string") return false;
  if (typeof e.difficulty !== "string") return false;
  if (!Array.isArray(e.tags)) return false;
  if (typeof e.wrongCount !== "number" || e.wrongCount < 0 || !Number.isFinite(e.wrongCount)) return false;
  if (typeof e.lastWrongAt !== "string") return false;
  if (typeof e.reviewStatus !== "string" || !VALID_REVIEW_STATUSES.has(e.reviewStatus)) return false;
  if (e.notePreview !== null && (typeof e.notePreview !== "string" || e.notePreview.length > MAX_NOTE_LENGTH)) return false;
  if (typeof e.sourceType !== "string") return false;
  if (typeof e.createdAt !== "string") return false;
  if (typeof e.updatedAt !== "string") return false;
  if (hasDangerousFields(entry)) return false;
  return true;
}

export function hasDangerousFields(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}

/**
 * Validate that a review status string is a valid WrongBookReviewStatus.
 */
export function isValidReviewStatus(s: unknown): s is WrongBookReviewStatus {
  return typeof s === "string" && VALID_REVIEW_STATUSES.has(s);
}

/**
 * Normalize note preview — enforce max length, strip dangerous patterns.
 */
export function normalizeNotePreview(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  // Reject if contains dangerous fields
  if (hasDangerousFields({ note: trimmed })) return null;
  return trimmed.slice(0, MAX_NOTE_LENGTH);
}

// ---------------------------------------------------------------------------
// Pure functions — no localStorage
// ---------------------------------------------------------------------------

export function isProblemInWrongBook(
  entries: readonly WrongBookEntry[],
  problemId: string,
): boolean {
  return entries.some((e) => e.problemId === problemId);
}

export function findWrongBookEntryByProblemId(
  entries: readonly WrongBookEntry[],
  problemId: string,
): WrongBookEntry | null {
  return entries.find((e) => e.problemId === problemId) ?? null;
}

export function addProblemToWrongBook(
  entries: readonly WrongBookEntry[],
  newEntry: WrongBookEntry,
): WrongBookEntry[] {
  // Idempotent — if already exists, return unchanged
  if (isProblemInWrongBook(entries, newEntry.problemId)) {
    return [...entries];
  }
  return [newEntry, ...entries];
}

export function recordProblemWrong(
  entries: readonly WrongBookEntry[],
  problemId: string,
  problemTitle: string,
  difficulty: string,
  tags: string[],
): { entries: WrongBookEntry[]; entry: WrongBookEntry | null } {
  const existingIdx = entries.findIndex((e) => e.problemId === problemId);
  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    const updated = {
      ...entries[existingIdx],
      title: problemTitle,
      difficulty,
      tags,
      wrongCount: entries[existingIdx].wrongCount + 1,
      lastWrongAt: now,
      updatedAt: now,
    };
    const newEntries = [...entries];
    newEntries[existingIdx] = updated;
    return { entries: newEntries, entry: updated };
  }

  // Not in wrong book yet — add with wrongCount=1
  const newEntry: WrongBookEntry = {
    wrongBookId: `local-wb-${problemId}-${Date.now()}`,
    problemId,
    title: problemTitle,
    difficulty,
    tags,
    wrongCount: 1,
    lastWrongAt: now,
    reviewStatus: "needs-review",
    notePreview: null,
    sourceType: "local-fallback",
    createdAt: now,
    updatedAt: now,
  };
  return { entries: [newEntry, ...entries], entry: newEntry };
}

export function removeProblemFromWrongBook(
  entries: readonly WrongBookEntry[],
  problemId: string,
): WrongBookEntry[] {
  // Safe when not found — returns unchanged
  if (!isProblemInWrongBook(entries, problemId)) {
    return [...entries];
  }
  return entries.filter((e) => e.problemId !== problemId);
}

export function updateWrongBookReviewStatus(
  entries: readonly WrongBookEntry[],
  problemId: string,
  newStatus: WrongBookReviewStatus,
): WrongBookEntry[] {
  return entries.map((e) =>
    e.problemId === problemId
      ? { ...e, reviewStatus: newStatus, updatedAt: new Date().toISOString() }
      : e,
  );
}

export function updateWrongBookNote(
  entries: readonly WrongBookEntry[],
  problemId: string,
  notePreview: string | null,
): WrongBookEntry[] {
  const normalized = normalizeNotePreview(notePreview);
  return entries.map((e) =>
    e.problemId === problemId
      ? { ...e, notePreview: normalized, updatedAt: new Date().toISOString() }
      : e,
  );
}

export function getNeedsReviewCount(
  entries: readonly WrongBookEntry[],
): number {
  return entries.filter((e) => e.reviewStatus === "needs-review").length;
}

export function getWrongBookCount(
  entries: readonly WrongBookEntry[],
): number {
  return entries.length;
}

export function getMostRecentWrongAt(
  entries: readonly WrongBookEntry[],
): string | null {
  if (entries.length === 0) return null;
  let latest = entries[0].lastWrongAt;
  for (const e of entries) {
    if (e.lastWrongAt > latest) latest = e.lastWrongAt;
  }
  return latest;
}

export function getWrongBookEntries(
  entries: readonly WrongBookEntry[],
  limit: number = 50,
): WrongBookEntry[] {
  return entries.slice(0, limit);
}

// ---------------------------------------------------------------------------
// localStorage read/write
// ---------------------------------------------------------------------------

export function loadWrongBook(): WrongBookEntry[] {
  const raw = safeGetItem(WRONG_BOOK_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(WRONG_BOOK_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(WRONG_BOOK_KEY);
    return [];
  }
  return parsed.filter(isValidWrongBookEntry);
}

export function persistWrongBook(
  entries: readonly WrongBookEntry[],
): boolean {
  const safe = entries.filter(isValidWrongBookEntry);
  return safeSetItem(WRONG_BOOK_KEY, JSON.stringify(safe));
}

export function clearWrongBook(): void {
  safeRemoveItem(WRONG_BOOK_KEY);
}
