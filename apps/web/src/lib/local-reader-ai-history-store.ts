/**
 * Local Reader AI History Store — localStorage fallback for safe QA history.
 *
 * Only stores safe previews (truncated question/answer), never raw
 * prompt/response, tokens, secrets, or full provider payloads.
 *
 * LocalStorage key: lap.web.reader.aiHistory
 *
 * Designation: **开发预览 · dev-only · local only · 不保存 raw 数据**
 *
 * @module local-reader-ai-history-store
 * @previewOnly
 */

export interface ReaderAiHistoryEntry {
  historyId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  questionPreview: string;
  answerPreview: string;
  providerMode: string;
  realProviderCalled: boolean;
  createdAt: string;
  sourceType: string;
  codeBlockCount: number;
  safeToExposeToClient: boolean;
  regionId?: string;
}

var STORE_KEY = "lap.web.reader.aiHistory";

var MAX_QUESTION_PREVIEW = 200;
var MAX_ANSWER_PREVIEW = 500;
var MAX_ENTRIES = 100;

var DANGEROUS_FIELDS = [
  "rawPrompt", "rawResponse", "rawRequest", "rawProviderPayload",
  "rawText", "fullChapterContent", "fullCodeFile",
  "token", "secret", "password", "apiKey", "authorization",
  "cookie", "DATABASE_URL", "sessionRaw",
];

function generateHistoryId(): string {
  var now = Date.now();
  var rand = Math.random().toString(36).slice(2, 10);
  return "local-ai-hist-" + now + "-" + rand;
}

function sanitizeEntry(entry: Partial<ReaderAiHistoryEntry>): ReaderAiHistoryEntry | null {
  if (!entry.bookId || !entry.chapterId || !entry.questionPreview || !entry.answerPreview) {
    return null;
  }

  // Check for dangerous fields
  for (var i = 0; i < DANGEROUS_FIELDS.length; i++) {
    if ((entry as Record<string, unknown>)[DANGEROUS_FIELDS[i]] !== undefined) {
      return null;
    }
  }

  var questionPreview = String(entry.questionPreview).slice(0, MAX_QUESTION_PREVIEW);
  var answerPreview = String(entry.answerPreview).slice(0, MAX_ANSWER_PREVIEW);

  return {
    historyId: entry.historyId || generateHistoryId(),
    bookId: String(entry.bookId),
    chapterId: String(entry.chapterId),
    bookTitle: String(entry.bookTitle || ""),
    chapterTitle: String(entry.chapterTitle || ""),
    questionPreview: questionPreview,
    answerPreview: answerPreview,
    providerMode: String(entry.providerMode || "mock"),
    realProviderCalled: Boolean(entry.realProviderCalled),
    createdAt: entry.createdAt || new Date().toISOString(),
    sourceType: String(entry.sourceType || "local"),
    codeBlockCount: Number(entry.codeBlockCount) || 0,
    safeToExposeToClient: Boolean(entry.safeToExposeToClient !== false),
  };
}

function readStore(): ReaderAiHistoryEntry[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }
    var raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    var entries: ReaderAiHistoryEntry[] = [];
    for (var i = 0; i < parsed.length; i++) {
      var entry = sanitizeEntry(parsed[i]);
      if (entry) entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

function writeStore(entries: ReaderAiHistoryEntry[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch {
    // Silently ignore write failures
  }
}

export function addReaderAiHistoryEntry(
  input: Omit<ReaderAiHistoryEntry, "historyId" | "createdAt"> & { historyId?: string; createdAt?: string },
): ReaderAiHistoryEntry | null {
  var entry = sanitizeEntry(input);
  if (!entry) return null;

  var entries = readStore();
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }
  writeStore(entries);
  return entry;
}

export function listReaderAiHistoryEntries(
  params?: { bookId?: string; chapterId?: string; limit?: number },
): ReaderAiHistoryEntry[] {
  var entries = readStore();
  if (params) {
    if (params.bookId) {
      entries = entries.filter(function (e) { return e.bookId === params!.bookId; });
    }
    if (params.chapterId) {
      entries = entries.filter(function (e) { return e.chapterId === params!.chapterId; });
    }
    if (params.limit && params.limit > 0) {
      entries = entries.slice(0, params.limit);
    }
  }
  return entries;
}

export function loadAiHistory(): ReaderAiHistoryEntry[] {
  return listReaderAiHistoryEntries();
}

export function getReaderAiHistoryCount(params?: { bookId?: string; chapterId?: string }): number {
  var entries = readStore();
  if (params) {
    if (params.bookId) {
      entries = entries.filter(function (e) { return e.bookId === params!.bookId; });
    }
    if (params.chapterId) {
      entries = entries.filter(function (e) { return e.chapterId === params!.chapterId; });
    }
  }
  return entries.length;
}

export function removeReaderAiHistoryEntry(historyId: string): boolean {
  var entries = readStore();
  var index = -1;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].historyId === historyId) {
      index = i;
      break;
    }
  }
  if (index < 0) return false;
  entries.splice(index, 1);
  writeStore(entries);
  return true;
}

export function clearReaderAiHistory(params?: { bookId?: string; chapterId?: string }): number {
  var entries = readStore();
  if (!params || (!params.bookId && !params.chapterId)) {
    writeStore([]);
    return entries.length;
  }
  var remaining: ReaderAiHistoryEntry[] = [];
  var removed = 0;
  for (var i = 0; i < entries.length; i++) {
    var match = true;
    if (params.bookId && entries[i].bookId !== params.bookId) match = false;
    if (params.chapterId && entries[i].chapterId !== params.chapterId) match = false;
    if (match) {
      removed++;
    } else {
      remaining.push(entries[i]);
    }
  }
  writeStore(remaining);
  return removed;
}

export function getAiHistoryStoreStatus(): {
  available: boolean;
  storeKey: string;
  entryCount: number;
  notice: string;
} {
  try {
    var entries = readStore();
    return {
      available: true,
      storeKey: STORE_KEY,
      entryCount: entries.length,
      notice: "仅保存安全摘要 · 不保存 raw prompt/response · localStorage 本地存储",
    };
  } catch {
    return {
      available: false,
      storeKey: STORE_KEY,
      entryCount: 0,
      notice: "localStorage 不可用或数据损坏",
    };
  }
}
