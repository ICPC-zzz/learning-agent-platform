/**
 * Local Learning Activity Store — localStorage fallback for learning activities
 * and reading sessions.
 *
 * Stores user learning activities and reading sessions in browser localStorage.
 * DB persistence is available only when the corresponding guard passes;
 * otherwise data stays in localStorage only.
 *
 * Keys:
 *   lap.web.user.learningActivities  — Array<LocalLearningActivity>
 *   lap.web.user.readingSessions     — Array<LocalReadingSession>
 *
 * All data is local-only. No tokens, cookies, secrets, or raw chapter text
 * are ever saved.
 *
 * @module local-learning-activity-store
 * @previewOnly — dev-only / local fallback / 未接生产账号
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityType =
  | "read-book"
  | "practice-problem"
  | "favorite-book"
  | "favorite-problem"
  | "add-note"
  | "add-bookmark"
  | "import-book";

export type TargetType = "book" | "chapter" | "problem" | "note" | "bookmark";

export interface LocalLearningActivity {
  activityId: string;
  activityType: ActivityType;
  title: string;
  targetType: TargetType;
  targetId: string;
  bookId: string | null;
  chapterId: string | null;
  problemId: string | null;
  sourceType: string;
  occurredAt: string;
  durationSeconds: number | null;
  metadataPreview: string | null;
}

export interface LocalReadingSession {
  sessionId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  progressRatio: number;
  sourceType: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITIES_KEY = "lap.web.user.learningActivities";
const SESSIONS_KEY = "lap.web.user.readingSessions";

const VALID_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  "read-book",
  "practice-problem",
  "favorite-book",
  "favorite-problem",
  "add-note",
  "add-bookmark",
  "import-book",
]);

const VALID_TARGET_TYPES: ReadonlySet<string> = new Set([
  "book",
  "chapter",
  "problem",
  "note",
  "bookmark",
]);

/** Maximum duration in seconds (8 hours). */
const MAX_DURATION_SECONDS = 28800;

/** Maximum metadataPreview length in characters. */
const MAX_METADATA_PREVIEW_LENGTH = 500;

/** Maximum title length. */
const MAX_TITLE_LENGTH = 300;

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
  /\braw[_\s]*prompt\b/i,
  /\braw[_\s]*response\b/i,
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

function isValidDuration(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return value >= 0 && value <= MAX_DURATION_SECONDS;
}

function isValidProgressRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isValidLocalLearningActivity(
  entry: unknown,
): entry is LocalLearningActivity {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (!isValidNonEmptyString(e.activityId)) return false;
  if (typeof e.activityType !== "string" || !VALID_ACTIVITY_TYPES.has(e.activityType)) return false;
  if (typeof e.title !== "string" || e.title.length > MAX_TITLE_LENGTH) return false;
  if (typeof e.targetType !== "string" || !VALID_TARGET_TYPES.has(e.targetType)) return false;
  if (!isValidNonEmptyString(e.targetId)) return false;
  if (e.bookId !== null && e.bookId !== undefined && typeof e.bookId !== "string") return false;
  if (e.chapterId !== null && e.chapterId !== undefined && typeof e.chapterId !== "string") return false;
  if (e.problemId !== null && e.problemId !== undefined && typeof e.problemId !== "string") return false;
  if (!isValidNonEmptyString(e.sourceType)) return false;
  if (!isValidIsoDate(e.occurredAt)) return false;
  if (!isValidDuration(e.durationSeconds)) return false;
  if (e.metadataPreview !== null && e.metadataPreview !== undefined && typeof e.metadataPreview !== "string") return false;
  if (typeof e.metadataPreview === "string" && e.metadataPreview.length > MAX_METADATA_PREVIEW_LENGTH) return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

export function isValidLocalReadingSession(
  entry: unknown,
): entry is LocalReadingSession {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (!isValidNonEmptyString(e.sessionId)) return false;
  if (!isValidNonEmptyString(e.bookId)) return false;
  if (!isValidNonEmptyString(e.chapterId)) return false;
  if (!isValidNonEmptyString(e.bookTitle)) return false;
  if (!isValidNonEmptyString(e.chapterTitle)) return false;
  if (!isValidIsoDate(e.startedAt)) return false;
  if (e.endedAt !== null && !isValidIsoDate(e.endedAt)) return false;
  if (typeof e.durationSeconds !== "number" || !Number.isFinite(e.durationSeconds)) return false;
  if (e.durationSeconds < 0 || e.durationSeconds > MAX_DURATION_SECONDS) return false;
  if (!isValidProgressRatio(e.progressRatio)) return false;
  if (!isValidNonEmptyString(e.sourceType)) return false;
  if (hasSensitiveFields(entry)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Learning Activities — load / persist / add
// ---------------------------------------------------------------------------

export function loadLearningActivities(): LocalLearningActivity[] {
  const raw = safeGetItem(ACTIVITIES_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(ACTIVITIES_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(ACTIVITIES_KEY);
    return [];
  }
  return parsed.filter(isValidLocalLearningActivity);
}

export function persistLearningActivities(
  activities: readonly LocalLearningActivity[],
): boolean {
  const safe = activities.filter(isValidLocalLearningActivity);
  return safeSetItem(ACTIVITIES_KEY, JSON.stringify(safe));
}

export function addLearningActivity(
  activities: readonly LocalLearningActivity[],
  entry: LocalLearningActivity,
): LocalLearningActivity[] {
  if (!isValidLocalLearningActivity(entry)) return [...activities];
  return [entry, ...activities];
}

/**
 * Get recent learning activities, optionally filtered by type.
 */
export function getRecentLearningActivities(
  activities: readonly LocalLearningActivity[],
  limit: number = 50,
  activityType?: ActivityType,
): LocalLearningActivity[] {
  let filtered = [...activities];
  if (activityType !== undefined) {
    filtered = filtered.filter((a) => a.activityType === activityType);
  }
  filtered.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return filtered.slice(0, limit);
}

/**
 * Count activities for today (local time).
 */
export function countTodayLearningActivities(
  activities: readonly LocalLearningActivity[],
): number {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  return activities.filter((a) => a.occurredAt >= todayStart).length;
}

/**
 * Total activity count.
 */
export function countTotalLearningActivities(
  activities: readonly LocalLearningActivity[],
): number {
  return activities.length;
}

// ---------------------------------------------------------------------------
// Reading Sessions — load / persist / add / end
// ---------------------------------------------------------------------------

export function loadReadingSessions(): LocalReadingSession[] {
  const raw = safeGetItem(SESSIONS_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(SESSIONS_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    safeRemoveItem(SESSIONS_KEY);
    return [];
  }
  return parsed.filter(isValidLocalReadingSession);
}

export function persistReadingSessions(
  sessions: readonly LocalReadingSession[],
): boolean {
  const safe = sessions.filter(isValidLocalReadingSession);
  return safeSetItem(SESSIONS_KEY, JSON.stringify(safe));
}

export function addReadingSession(
  sessions: readonly LocalReadingSession[],
  entry: LocalReadingSession,
): LocalReadingSession[] {
  if (!isValidLocalReadingSession(entry)) return [...sessions];
  return [entry, ...sessions];
}

/**
 * End a reading session by sessionId.
 * Sets endedAt and updates durationSeconds.
 */
export function endReadingSession(
  sessions: readonly LocalReadingSession[],
  sessionId: string,
  endedAt: string,
  durationSeconds?: number,
): LocalReadingSession[] {
  return sessions.map((s) => {
    if (s.sessionId !== sessionId) return s;
    const endTime = endedAt;
    const computedDuration =
      durationSeconds !== undefined
        ? Math.min(Math.max(0, Math.trunc(durationSeconds)), MAX_DURATION_SECONDS)
        : Math.max(0, Math.trunc((new Date(endTime).getTime() - new Date(s.startedAt).getTime()) / 1000));
    const updated = {
      ...s,
      endedAt: endTime,
      durationSeconds: Math.min(computedDuration, MAX_DURATION_SECONDS),
    };
    return isValidLocalReadingSession(updated) ? updated : s;
  });
}

/**
 * Summarize all reading sessions.
 */
export function summarizeReadingSessions(
  sessions: readonly LocalReadingSession[],
): { totalSessions: number; totalDurationSeconds: number; totalDurationMinutes: number } {
  const totalDurationSeconds = sessions.reduce(
    (sum, s) => sum + Math.max(0, s.durationSeconds),
    0,
  );
  return {
    totalSessions: sessions.length,
    totalDurationSeconds,
    totalDurationMinutes: Math.round(totalDurationSeconds / 60),
  };
}

/**
 * Get today's total reading duration in seconds.
 */
export function todayReadingDurationSeconds(
  sessions: readonly LocalReadingSession[],
): number {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  return sessions
    .filter((s) => s.startedAt >= todayStart)
    .reduce((sum, s) => sum + Math.max(0, s.durationSeconds), 0);
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateLearningActivityId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `act-${ts}-${rand}`;
}

export function generateReadingSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `rs-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Forbidden label check
// ---------------------------------------------------------------------------

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实数据",
  "云端同步成功",
  "生产学习记录已保存",
  "真实学习系统已完成",
  "真实判题已接入",
  "账号同步完成",
] as const;

export function hasForbiddenLabels(text: string): boolean {
  return FORBIDDEN_LABELS.some((label) => text.includes(label));
}
