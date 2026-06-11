/**
 * Local Reader Annotation Store — localStorage fallback for reader bookmarks & notes.
 *
 * Stores reader bookmarks and reading notes in browser localStorage.
 * DB persistence is available only when the corresponding guard passes;
 * otherwise data stays in localStorage only.
 *
 * Keys:
 *   lap.web.user.readerBookmarks  — Array<ReaderLocalBookmark>
 *   lap.web.user.readerNotes      — Array<ReaderLocalNote>
 *
 * All data is local-only. No tokens, cookies, secrets, or raw chapter text
 * are ever saved.
 *
 * @module local-reader-annotation-store
 * @previewOnly — dev-only / local fallback / 未接生产账号
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderLocalBookmark {
  bookmarkId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReaderLocalNote {
  noteId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteText: string;
  excerptPreview: string | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const BOOKMARKS_KEY = "lap.web.user.readerBookmarks";
const NOTES_KEY = "lap.web.user.readerNotes";

/** Maximum noteText length in characters. */
const MAX_NOTE_TEXT_LENGTH = 1000;

/** Maximum excerptPreview length in characters. */
const MAX_EXCERPT_PREVIEW_LENGTH = 160;

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
  /\bfullChapterContent\b/i,
  /\brawText\b/i,
];

// ---------------------------------------------------------------------------
// localStorage read/write helpers
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
// Validation
// ---------------------------------------------------------------------------

export function hasSensitiveFields(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}

function isValidNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isValidProgressRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isValidReaderLocalBookmark(
  entry: unknown,
): entry is ReaderLocalBookmark {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (!isValidNonEmptyString(e.bookmarkId)) return false;
  if (!isValidNonEmptyString(e.bookId)) return false;
  if (!isValidNonEmptyString(e.chapterId)) return false;
  if (!isValidNonEmptyString(e.bookTitle)) return false;
  if (!isValidNonEmptyString(e.chapterTitle)) return false;
  if (!isValidProgressRatio(e.progressRatio)) return false;
  if (!isValidNonEmptyString(e.sourceType)) return false;
  if (!isValidIsoDate(e.createdAt)) return false;
  if (!isValidIsoDate(e.updatedAt)) return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

export function isValidReaderLocalNote(
  entry: unknown,
): entry is ReaderLocalNote {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (!isValidNonEmptyString(e.noteId)) return false;
  if (!isValidNonEmptyString(e.bookId)) return false;
  if (!isValidNonEmptyString(e.chapterId)) return false;
  if (!isValidNonEmptyString(e.bookTitle)) return false;
  if (!isValidNonEmptyString(e.chapterTitle)) return false;
  if (!isValidProgressRatio(e.progressRatio)) return false;
  if (typeof e.noteText !== "string") return false;
  if (e.noteText.length > MAX_NOTE_TEXT_LENGTH) return false;
  if (e.excerptPreview !== null && typeof e.excerptPreview !== "string") return false;
  if (typeof e.excerptPreview === "string" && e.excerptPreview.length > MAX_EXCERPT_PREVIEW_LENGTH) return false;
  if (!isValidNonEmptyString(e.sourceType)) return false;
  if (!isValidIsoDate(e.createdAt)) return false;
  if (!isValidIsoDate(e.updatedAt)) return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Bookmarks — load / persist / add / remove
// ---------------------------------------------------------------------------

export function loadReaderBookmarks(): ReaderLocalBookmark[] {
  const raw = safeGetItem(BOOKMARKS_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(BOOKMARKS_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(BOOKMARKS_KEY);
    return [];
  }
  return parsed.filter(isValidReaderLocalBookmark);
}

export function persistReaderBookmarks(
  bookmarks: readonly ReaderLocalBookmark[],
): boolean {
  const safe = bookmarks.filter(isValidReaderLocalBookmark);
  return safeSetItem(BOOKMARKS_KEY, JSON.stringify(safe));
}

/**
 * Add or update a bookmark for a given (bookId, chapterId) pair.
 * Idempotent: if a bookmark already exists for the same book+chapter,
 * it is updated in place.
 */
export function addReaderBookmark(
  bookmarks: readonly ReaderLocalBookmark[],
  entry: ReaderLocalBookmark,
): ReaderLocalBookmark[] {
  if (!isValidReaderLocalBookmark(entry)) return [...bookmarks];
  const filtered = bookmarks.filter(
    (b) => !(b.bookId === entry.bookId && b.chapterId === entry.chapterId),
  );
  return [entry, ...filtered];
}

/**
 * Remove a bookmark by bookmarkId.
 */
export function removeReaderBookmark(
  bookmarks: readonly ReaderLocalBookmark[],
  bookmarkId: string,
): ReaderLocalBookmark[] {
  return bookmarks.filter((b) => b.bookmarkId !== bookmarkId);
}

/**
 * Remove a bookmark by (bookId, chapterId).
 */
export function removeReaderBookmarkByChapter(
  bookmarks: readonly ReaderLocalBookmark[],
  bookId: string,
  chapterId: string,
): ReaderLocalBookmark[] {
  return bookmarks.filter(
    (b) => !(b.bookId === bookId && b.chapterId === chapterId),
  );
}

/**
 * Check if a bookmark exists for a given (bookId, chapterId) pair.
 */
export function isReaderBookmarked(
  bookmarks: readonly ReaderLocalBookmark[],
  bookId: string,
  chapterId: string,
): boolean {
  return bookmarks.some(
    (b) => b.bookId === bookId && b.chapterId === chapterId,
  );
}

// ---------------------------------------------------------------------------
// Notes — load / persist / add / update / remove
// ---------------------------------------------------------------------------

export function loadReaderNotes(): ReaderLocalNote[] {
  const raw = safeGetItem(NOTES_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(NOTES_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(NOTES_KEY);
    return [];
  }
  return parsed.filter(isValidReaderLocalNote);
}

export function persistReaderNotes(
  notes: readonly ReaderLocalNote[],
): boolean {
  const safe = notes.filter(isValidReaderLocalNote);
  return safeSetItem(NOTES_KEY, JSON.stringify(safe));
}

/**
 * Add a new note. Does NOT enforce uniqueness — multiple notes per chapter allowed.
 */
export function addReaderNote(
  notes: readonly ReaderLocalNote[],
  entry: ReaderLocalNote,
): ReaderLocalNote[] {
  if (!isValidReaderLocalNote(entry)) return [...notes];
  return [entry, ...notes];
}

/**
 * Update an existing note by noteId.
 */
export function updateReaderNote(
  notes: readonly ReaderLocalNote[],
  noteId: string,
  updates: Partial<Pick<ReaderLocalNote, "noteText" | "excerptPreview" | "progressRatio">>,
): ReaderLocalNote[] {
  return notes.map((n) => {
    if (n.noteId !== noteId) return n;
    const updated: ReaderLocalNote = {
      ...n,
      ...updates,
      noteText: typeof updates.noteText === "string"
        ? updates.noteText.slice(0, MAX_NOTE_TEXT_LENGTH)
        : n.noteText,
      excerptPreview: updates.excerptPreview !== undefined
        ? (typeof updates.excerptPreview === "string"
          ? updates.excerptPreview.slice(0, MAX_EXCERPT_PREVIEW_LENGTH)
          : updates.excerptPreview)
        : n.excerptPreview,
      updatedAt: new Date().toISOString(),
    };
    return isValidReaderLocalNote(updated) ? updated : n;
  });
}

/**
 * Remove a note by noteId.
 */
export function removeReaderNote(
  notes: readonly ReaderLocalNote[],
  noteId: string,
): ReaderLocalNote[] {
  return notes.filter((n) => n.noteId !== noteId);
}

/**
 * Get notes for a specific chapter.
 */
export function getReaderNotesByChapter(
  notes: readonly ReaderLocalNote[],
  bookId: string,
  chapterId: string,
): ReaderLocalNote[] {
  return notes.filter(
    (n) => n.bookId === bookId && n.chapterId === chapterId,
  );
}

// ---------------------------------------------------------------------------
// Note text validation
// ---------------------------------------------------------------------------

export function validateNoteText(
  text: string,
): { valid: boolean; reason?: string } {
  if (typeof text !== "string") {
    return { valid: false, reason: "noteText 必须为字符串。" };
  }
  if (text.length > MAX_NOTE_TEXT_LENGTH) {
    return {
      valid: false,
      reason: `noteText 长度不能超过 ${MAX_NOTE_TEXT_LENGTH} 字。`,
    };
  }
  if (hasSensitiveFields({ text })) {
    return { valid: false, reason: "noteText 包含敏感字段，已拒绝。" };
  }
  return { valid: true };
}

export function normalizeNoteText(text: string): string {
  return text.slice(0, MAX_NOTE_TEXT_LENGTH);
}

export function normalizeExcerptPreview(
  excerpt: string | null | undefined,
): string | null {
  if (excerpt === null || excerpt === undefined) return null;
  if (typeof excerpt !== "string") return null;
  const trimmed = excerpt.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_EXCERPT_PREVIEW_LENGTH);
}

// ---------------------------------------------------------------------------
// Helpers — generate stable IDs
// ---------------------------------------------------------------------------

export function generateAnnotationId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Build a stable bookmark ID from bookId and chapterId.
 * This makes bookmark creation idempotent across sessions.
 */
export function buildStableBookmarkId(bookId: string, chapterId: string): string {
  return `bm-${bookId}-${chapterId}`;
}

// ---------------------------------------------------------------------------
// Forbidden label check
// ---------------------------------------------------------------------------

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实数据",
  "云端同步成功",
  "生产笔记已保存",
  "真实用户笔记系统",
  "云端书签已同步",
  "账号同步完成",
] as const;

export function hasForbiddenLabels(text: string): boolean {
  return FORBIDDEN_LABELS.some((label) => text.includes(label));
}
