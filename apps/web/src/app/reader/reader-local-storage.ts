"use client";

export interface ReaderLocalScope {
  bookId: string | null;
  chapterId: string | null;
  bookSegment: string;
  chapterSegment: string;
  hasIdentifiers: boolean;
}

export interface ReaderLocalBookmarkRecord {
  bookId: string;
  chapterId: string;
  bookTitle: string | null;
  chapterTitle: string | null;
  scrollPercent: number | null;
  updatedAt: string;
}

export interface ReaderLocalNoteRecord {
  bookId: string;
  chapterId: string;
  content: string;
  updatedAt: string;
}

export interface ReaderLocalTimerRecord {
  bookId: string;
  chapterId: string;
  totalSeconds: number;
  isRunning: boolean;
  lastStartedAt: string | null;
  updatedAt: string;
}

const KEY_PREFIX = "lap.reader";
const READER_SYNC_SWITCH_KEY = `${KEY_PREFIX}.syncSwitch`;
const STORAGE_UPDATE_EVENT = "lap-reader-local-storage-updated";

function normalizeSegment(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getReaderLocalScope(
  bookId?: string | null,
  chapterId?: string | null,
): ReaderLocalScope {
  const normalizedBookId = normalizeSegment(bookId);
  const normalizedChapterId = normalizeSegment(chapterId);
  return {
    bookId: normalizedBookId,
    chapterId: normalizedChapterId,
    bookSegment: normalizedBookId ?? "unknown-book",
    chapterSegment: normalizedChapterId ?? "unknown-chapter",
    hasIdentifiers: normalizedBookId !== null && normalizedChapterId !== null,
  };
}

export function buildReaderBookmarkStorageKey(
  bookId?: string | null,
  chapterId?: string | null,
): string {
  const scope = getReaderLocalScope(bookId, chapterId);
  return `${KEY_PREFIX}.bookmark.${scope.bookSegment}.${scope.chapterSegment}`;
}

export function buildReaderNoteStorageKey(
  bookId?: string | null,
  chapterId?: string | null,
): string {
  const scope = getReaderLocalScope(bookId, chapterId);
  return `${KEY_PREFIX}.note.${scope.bookSegment}.${scope.chapterSegment}`;
}

export function buildReaderTimerStorageKey(
  bookId?: string | null,
  chapterId?: string | null,
): string {
  const scope = getReaderLocalScope(bookId, chapterId);
  return `${KEY_PREFIX}.timer.${scope.bookSegment}.${scope.chapterSegment}`;
}

export function getReaderSyncSwitchStorageKey(): string {
  return READER_SYNC_SWITCH_KEY;
}

export function isReaderLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const probeKey = `${KEY_PREFIX}.probe`;
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function dispatchStorageUpdate(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ key: string }>(STORAGE_UPDATE_EVENT, {
      detail: { key },
    }),
  );
}

function readJson<T>(key: string, validator: (value: unknown) => value is T): T | null {
  if (!isReaderLocalStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!validator(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): boolean {
  if (!isReaderLocalStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    dispatchStorageUpdate(key);
    return true;
  } catch {
    return false;
  }
}

function removeStorageKey(key: string): boolean {
  if (!isReaderLocalStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    dispatchStorageUpdate(key);
    return true;
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isReaderLocalBookmarkRecord(value: unknown): value is ReaderLocalBookmarkRecord {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.bookId === "string" &&
    record.bookId.length > 0 &&
    typeof record.chapterId === "string" &&
    record.chapterId.length > 0 &&
    (record.bookTitle === null || typeof record.bookTitle === "string") &&
    (record.chapterTitle === null || typeof record.chapterTitle === "string") &&
    (record.scrollPercent === null || isNonNegativeNumber(record.scrollPercent)) &&
    isIsoDate(record.updatedAt)
  );
}

function isReaderLocalNoteRecord(value: unknown): value is ReaderLocalNoteRecord {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.bookId === "string" &&
    record.bookId.length > 0 &&
    typeof record.chapterId === "string" &&
    record.chapterId.length > 0 &&
    typeof record.content === "string" &&
    isIsoDate(record.updatedAt)
  );
}

function isReaderLocalTimerRecord(value: unknown): value is ReaderLocalTimerRecord {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.bookId === "string" &&
    record.bookId.length > 0 &&
    typeof record.chapterId === "string" &&
    record.chapterId.length > 0 &&
    isNonNegativeNumber(record.totalSeconds) &&
    typeof record.isRunning === "boolean" &&
    (record.lastStartedAt === null || isIsoDate(record.lastStartedAt)) &&
    isIsoDate(record.updatedAt)
  );
}

export function readReaderLocalBookmark(
  bookId?: string | null,
  chapterId?: string | null,
): ReaderLocalBookmarkRecord | null {
  const key = buildReaderBookmarkStorageKey(bookId, chapterId);
  return readJson(key, isReaderLocalBookmarkRecord);
}

export function writeReaderLocalBookmark(
  bookId: string,
  chapterId: string,
  value: ReaderLocalBookmarkRecord,
): boolean {
  const key = buildReaderBookmarkStorageKey(bookId, chapterId);
  return writeJson(key, value);
}

export function removeReaderLocalBookmark(
  bookId?: string | null,
  chapterId?: string | null,
): boolean {
  const key = buildReaderBookmarkStorageKey(bookId, chapterId);
  return removeStorageKey(key);
}

export function readReaderLocalNote(
  bookId?: string | null,
  chapterId?: string | null,
): ReaderLocalNoteRecord | null {
  const key = buildReaderNoteStorageKey(bookId, chapterId);
  return readJson(key, isReaderLocalNoteRecord);
}

export function writeReaderLocalNote(
  bookId: string,
  chapterId: string,
  value: ReaderLocalNoteRecord,
): boolean {
  const key = buildReaderNoteStorageKey(bookId, chapterId);
  return writeJson(key, value);
}

export function removeReaderLocalNote(
  bookId?: string | null,
  chapterId?: string | null,
): boolean {
  const key = buildReaderNoteStorageKey(bookId, chapterId);
  return removeStorageKey(key);
}

export function readReaderLocalTimer(
  bookId?: string | null,
  chapterId?: string | null,
): ReaderLocalTimerRecord | null {
  const key = buildReaderTimerStorageKey(bookId, chapterId);
  return readJson(key, isReaderLocalTimerRecord);
}

export function writeReaderLocalTimer(
  bookId: string,
  chapterId: string,
  value: ReaderLocalTimerRecord,
): boolean {
  const key = buildReaderTimerStorageKey(bookId, chapterId);
  return writeJson(key, value);
}

export function removeReaderLocalTimer(
  bookId?: string | null,
  chapterId?: string | null,
): boolean {
  const key = buildReaderTimerStorageKey(bookId, chapterId);
  return removeStorageKey(key);
}

export function readReaderSyncSwitch(): boolean {
  const stored = readJson(READER_SYNC_SWITCH_KEY, isBoolean);
  return stored ?? false;
}

export function writeReaderSyncSwitch(enabled: boolean): boolean {
  return writeJson(READER_SYNC_SWITCH_KEY, enabled);
}

export function subscribeReaderLocalStorageChanges(
  onChange: (changedKey: string | null) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    onChange(event.key ?? null);
  };

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string }>).detail;
    onChange(detail?.key ?? null);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_UPDATE_EVENT, handleCustom as EventListener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_UPDATE_EVENT, handleCustom as EventListener);
  };
}

export function formatReaderLocalTimestamp(iso?: string | null): string {
  if (!iso) {
    return "-";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatReaderDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    if (minutes === 0 && seconds === 0) {
      return `${hours} 小时`;
    }
    if (seconds === 0) {
      return `${hours} 小时 ${minutes} 分`;
    }
    return `${hours} 小时 ${minutes} 分 ${seconds} 秒`;
  }

  if (minutes > 0) {
    if (seconds === 0) {
      return `${minutes} 分`;
    }
    return `${minutes} 分 ${seconds} 秒`;
  }

  return `${seconds} 秒`;
}

function toSafeEpochMs(iso: string | null): number {
  if (iso === null) {
    return 0;
  }

  const epoch = Date.parse(iso);
  if (Number.isNaN(epoch)) {
    return 0;
  }

  return epoch;
}

export function getReaderTimerCurrentTotalSeconds(
  timer: ReaderLocalTimerRecord,
  nowEpochMs = Date.now(),
): number {
  if (!timer.isRunning || timer.lastStartedAt === null) {
    return Math.max(0, Math.floor(timer.totalSeconds));
  }

  const startedAtMs = toSafeEpochMs(timer.lastStartedAt);
  if (startedAtMs <= 0 || nowEpochMs <= startedAtMs) {
    return Math.max(0, Math.floor(timer.totalSeconds));
  }

  const deltaSeconds = Math.floor((nowEpochMs - startedAtMs) / 1000);
  return Math.max(0, Math.floor(timer.totalSeconds) + deltaSeconds);
}

export function buildDefaultReaderTimerRecord(
  bookId: string,
  chapterId: string,
): ReaderLocalTimerRecord {
  const now = new Date().toISOString();
  return {
    bookId,
    chapterId,
    totalSeconds: 0,
    isRunning: false,
    lastStartedAt: null,
    updatedAt: now,
  };
}
