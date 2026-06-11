/**
 * Learning Insight Local Data — unified local data reader and formatter.
 *
 * Aggregates safe summaries from ALL available localStorage stores into
 * the input shapes expected by the learning-insight view models.
 *
 * DESIGN: Pure functions only — NO direct browser API access.
 * Hydration components call localStorage stores, then pass results here.
 *
 * @module learning-insight-local-data
 * @previewOnly — dev-only / local fallback / 未接生产账号
 */

// ---------------------------------------------------------------------------
// Unified local input type (everything hydration can pull from localStorage)
// ---------------------------------------------------------------------------

export interface UnifiedLocalLearningInput {
  /** Raw arrays from localStorage stores — empty = no data */
  readingSessions: Array<{
    bookId: string;
    chapterId: string;
    bookTitle: string;
    chapterTitle: string;
    durationSeconds: number;
    startedAt: string;
    endedAt: string | null;
    progressRatio: number;
  }>;
  learningActivities: Array<{
    activityId: string;
    activityType: string;
    title: string;
    targetType: string;
    targetId: string;
    bookId: string | null;
    chapterId: string | null;
    problemId: string | null;
    occurredAt: string;
    durationSeconds: number | null;
  }>;
  wrongBookEntries: Array<{
    wrongBookId: string;
    problemId: string;
    title: string;
    difficulty: string;
    tags: string[];
    wrongCount: number;
    lastWrongAt: string;
    reviewStatus: string;
    notePreview: string | null;
    sourceType: string;
  }>;
  recentReading: Array<{
    bookId: string;
    chapterId: string;
    bookTitle: string;
    chapterTitle: string;
    progressRatio: number;
    lastReadAt: string;
    sourceType: string;
  }>;
  recentPractice: Array<{
    problemId: string;
    title: string;
    difficulty: string;
    status: string;
    updatedAt: string;
  }>;
  favoriteProblems: Array<{
    problemId: string;
    title: string;
    difficulty: string;
    tags: string[];
    favoritedAt: string;
  }>;
  bookmarks: Array<{
    bookId: string;
    chapterId: string;
    bookTitle: string;
    chapterTitle: string;
    createdAt: string;
  }>;
  notes: Array<{
    noteId: string;
    bookId: string;
    chapterId: string;
    bookTitle: string;
    chapterTitle: string;
    noteTextPreview: string;
    createdAt: string;
  }>;
  aiHistory: Array<{
    historyId: string;
    bookId: string;
    chapterId: string;
    bookTitle: string;
    chapterTitle: string;
    questionPreview: string;
    createdAt: string;
  }>;
  /** Whether a dev session exists. */
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Empty unified input (safe default when no localStorage data exists)
// ---------------------------------------------------------------------------

export function createEmptyUnifiedInput(hasSession: boolean): UnifiedLocalLearningInput {
  return {
    readingSessions: [],
    learningActivities: [],
    wrongBookEntries: [],
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    hasSession,
  };
}

// ---------------------------------------------------------------------------
// Derived summaries
// ---------------------------------------------------------------------------

export function buildReadingSessionSummary(input: UnifiedLocalLearningInput): {
  totalSessions: number;
  totalDurationMinutes: number;
  todayDurationMinutes: number;
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let totalSeconds = 0;
  let todaySeconds = 0;

  for (let i = 0; i < input.readingSessions.length; i++) {
    const s = input.readingSessions[i];
    const duration = Math.max(0, s.durationSeconds || 0);
    totalSeconds += duration;
    if (s.startedAt >= todayStart) {
      todaySeconds += duration;
    }
  }

  return {
    totalSessions: input.readingSessions.length,
    totalDurationMinutes: Math.round(totalSeconds / 60),
    todayDurationMinutes: Math.round(todaySeconds / 60),
  };
}

/**
 * Summarize the unified input for the dashboard stats card.
 */
export function buildDashboardLocalInsightStats(input: UnifiedLocalLearningInput): {
  todayTaskCount: number;
  reviewRecommendationCount: number;
  localActivityCount: number;
  localReadingMinutes: number;
  wrongBookNeedsReviewCount: number;
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Today activity count
  const todayActivityCount = input.learningActivities.filter(function (a) {
    return a.occurredAt >= todayStart;
  }).length;

  // Review recommendation count (approximation: wrong book needs-review + recent practice needs-review)
  const wrongBookNeedsReviewCount = input.wrongBookEntries.filter(function (e) {
    return e.reviewStatus === "needs-review";
  }).length;

  const practiceNeedsReviewCount = input.recentPractice.filter(function (p) {
    return p.status === "needs-review";
  }).length;

  // Reading minutes
  const readingSummary = buildReadingSessionSummary(input);

  return {
    todayTaskCount: todayActivityCount,
    reviewRecommendationCount: wrongBookNeedsReviewCount + practiceNeedsReviewCount,
    localActivityCount: input.learningActivities.length,
    localReadingMinutes: readingSummary.totalDurationMinutes,
    wrongBookNeedsReviewCount,
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\braw[_\s]*prompt\b/i,
  /\braw[_\s]*response\b/i,
  /\brawText\b/i,
  /\bfullChapterContent\b/i,
  /\bsubmittedCode\b/i,
];

const FORBIDDEN_LABELS = [
  "AI 已自动规划",
  "生产学习报告",
  "真实云端同步",
  "真实判题已接入",
  "Agent 已运行",
  "LLM 生成",
];

/**
 * Returns whether the unified input is safe (no sensitive fields).
 */
export function unifiedInputIsSafe(input: UnifiedLocalLearningInput): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(input);

  for (let i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("Sensitive field matched: " + SENSITIVE_PATTERNS[i].source);
    }
  }

  for (let j = 0; j < FORBIDDEN_LABELS.length; j++) {
    if (json.includes(FORBIDDEN_LABELS[j])) {
      violations.push("Forbidden label found: " + FORBIDDEN_LABELS[j]);
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Sanitize a potentially malformed unified input — returns empty safe defaults
 * for each field that's not an array or contains dangerous data.
 */
export function sanitizeUnifiedInput(raw: unknown): UnifiedLocalLearningInput {
  if (typeof raw !== "object" || raw === null) {
    return createEmptyUnifiedInput(false);
  }

  const obj = raw as Record<string, unknown>;

  function safeArray(key: string): unknown[] {
    const val = obj[key];
    if (Array.isArray(val) && !hasSensitiveInArray(val)) return val;
    return [];
  }

  return {
    readingSessions: safeArray("readingSessions"),
    learningActivities: safeArray("learningActivities"),
    wrongBookEntries: safeArray("wrongBookEntries"),
    recentReading: safeArray("recentReading"),
    recentPractice: safeArray("recentPractice"),
    favoriteProblems: safeArray("favoriteProblems"),
    bookmarks: safeArray("bookmarks"),
    notes: safeArray("notes"),
    aiHistory: safeArray("aiHistory"),
    hasSession: typeof obj.hasSession === "boolean" ? obj.hasSession : false,
  };
}

function hasSensitiveInArray(arr: unknown[]): boolean {
  const json = JSON.stringify(arr);
  for (let i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safe truncation of a string, for use when constructing report summaries.
 */
export function safeTruncate(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, maxLen);
}
