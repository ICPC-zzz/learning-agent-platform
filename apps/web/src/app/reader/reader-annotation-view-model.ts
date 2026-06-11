/**
 * Reader Annotation View Model — computes bookmark and note UI state
 * for the Reader page controls.
 *
 * Handles: guard blocked, local fallback, DB success, empty state,
 * field sanitization, and forbidden label detection.
 *
 * @module reader-annotation-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { ReaderLocalBookmark, ReaderLocalNote } from "../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookmarkControlState {
  /** Whether the current chapter is bookmarked (local + DB merged). */
  isBookmarked: boolean;
  /** Where the bookmark data comes from. */
  bookmarkSource: "db" | "local" | "none";
  /** The local bookmark entry (if exists in localStorage). */
  localBookmark: ReaderLocalBookmark | null;
  /** Whether DB bookmark guard is enabled. */
  dbBookmarkEnabled: boolean;
  /** Whether a dev session exists. */
  hasDevSession: boolean;
  /** Human-readable data source notice. */
  dataSourceNotice: string;
  /** Safe result flag. */
  isDevOnly: true;
  productionReady: false;
}

export interface NoteControlState {
  /** Local notes for the current chapter. */
  localNotes: ReaderLocalNote[];
  /** Whether DB note guard is enabled. */
  dbNoteEnabled: boolean;
  /** Whether a dev session exists. */
  hasDevSession: boolean;
  /** Human-readable data source notice. */
  dataSourceNotice: string;
  /** Safe result flag. */
  isDevOnly: true;
  productionReady: false;
}

export interface NoteValidationResult {
  valid: boolean;
  reason?: string;
  normalizedText: string;
  normalizedExcerpt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_NOTE_TEXT_LENGTH = 1000;
const MAX_EXCERPT_PREVIEW_LENGTH = 160;

const DATA_SOURCE_NOTICES = {
  db: "开发 DB 书签（dev-only）· 绑定 dev session · 未接生产同步",
  local: "本地书签 fallback · 未连接数据库 · 未接生产账号",
  none: "暂无书签",
} as const;

const NOTE_DATA_SOURCE_NOTICES = {
  db: "开发 DB 笔记（dev-only）· 绑定 dev session · 未接生产同步",
  local: "本地笔记 fallback · 未连接数据库 · 未接生产账号",
  none: "暂无笔记",
} as const;

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实数据",
  "云端同步成功",
  "生产笔记已保存",
  "真实用户笔记系统",
  "云端书签已同步",
  "账号同步完成",
  "正式书签同步完成",
] as const;

const SENSITIVE_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
  /\bfullChapterContent\b/i,
  /\brawText\b/i,
];

// ---------------------------------------------------------------------------
// Bookmark control state builder
// ---------------------------------------------------------------------------

export function buildBookmarkControlState(input: {
  isBookmarkedInLocal: boolean;
  localBookmark: ReaderLocalBookmark | null;
  isBookmarkedInDb: boolean;
  dbBookmarkEnabled: boolean;
  hasDevSession: boolean;
}): BookmarkControlState {
  const { isBookmarkedInLocal, localBookmark, isBookmarkedInDb, dbBookmarkEnabled, hasDevSession } = input;

  // DB takes priority when enabled and a dev session exists
  const useDb = dbBookmarkEnabled && hasDevSession;
  const isBookmarked = useDb
    ? isBookmarkedInDb || isBookmarkedInLocal
    : isBookmarkedInLocal;

  const bookmarkSource: "db" | "local" | "none" = !isBookmarked
    ? "none"
    : useDb && isBookmarkedInDb
      ? "db"
      : "local";

  const dataSourceNotice = useDb
    ? DATA_SOURCE_NOTICES.db
    : isBookmarkedInLocal
      ? DATA_SOURCE_NOTICES.local
      : DATA_SOURCE_NOTICES.none;

  return {
    isBookmarked,
    bookmarkSource,
    localBookmark,
    dbBookmarkEnabled: useDb,
    hasDevSession,
    dataSourceNotice,
    isDevOnly: true,
    productionReady: false,
  };
}

// ---------------------------------------------------------------------------
// Note control state builder
// ---------------------------------------------------------------------------

export function buildNoteControlState(input: {
  localNotes: ReaderLocalNote[];
  dbNoteEnabled: boolean;
  hasDevSession: boolean;
}): NoteControlState {
  const { localNotes, dbNoteEnabled, hasDevSession } = input;
  const useDb = dbNoteEnabled && hasDevSession;

  return {
    localNotes,
    dbNoteEnabled: useDb,
    hasDevSession,
    dataSourceNotice: useDb
      ? NOTE_DATA_SOURCE_NOTICES.db
      : localNotes.length > 0
        ? NOTE_DATA_SOURCE_NOTICES.local
        : NOTE_DATA_SOURCE_NOTICES.none,
    isDevOnly: true,
    productionReady: false,
  };
}

// ---------------------------------------------------------------------------
// Note text validation
// ---------------------------------------------------------------------------

export function validateAndNormalizeNoteInput(input: {
  text: string;
  excerpt?: string | null;
}): NoteValidationResult {
  const { text, excerpt } = input;

  if (typeof text !== "string") {
    return { valid: false, reason: "noteText 必须为字符串。", normalizedText: "", normalizedExcerpt: null };
  }

  if (text.length > MAX_NOTE_TEXT_LENGTH) {
    return {
      valid: false,
      reason: `noteText 长度不能超过 ${MAX_NOTE_TEXT_LENGTH} 字。`,
      normalizedText: text.slice(0, MAX_NOTE_TEXT_LENGTH),
      normalizedExcerpt: normalizeExcerptPreview(excerpt),
    };
  }

  if (text.trim().length === 0) {
    return { valid: false, reason: "noteText 不能为空。", normalizedText: "", normalizedExcerpt: null };
  }

  if (hasSensitiveFields(text)) {
    return { valid: false, reason: "noteText 包含敏感字段，已拒绝。", normalizedText: "", normalizedExcerpt: null };
  }

  const normalizedExcerpt = normalizeExcerptPreview(excerpt);

  return {
    valid: true,
    normalizedText: text.slice(0, MAX_NOTE_TEXT_LENGTH),
    normalizedExcerpt,
  };
}

// ---------------------------------------------------------------------------
// Sanitization & safety
// ---------------------------------------------------------------------------

export function hasSensitiveFields(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

export function hasForbiddenLabels(text: string): boolean {
  return FORBIDDEN_LABELS.some((label) => text.includes(label));
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

/**
 * Verify a bookmark control state contains no sensitive fields
 * or forbidden labels.
 */
export function bookmarkControlStateIsSafe(
  state: BookmarkControlState,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(state);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Verify a note control state contains no sensitive fields
 * or forbidden labels.
 */
export function noteControlStateIsSafe(
  state: NoteControlState,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(state);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  return { safe: violations.length === 0, violations };
}
