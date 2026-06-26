/**
 * Local Daily Challenge Store — localStorage-based daily challenge state.
 *
 * Key: lap.web.user.dailyChallenge
 *
 * Stores today's challenge problem, status, and timestamps. All data is
 * local-only. No tokens, cookies, secrets, user-submitted code, or raw
 * prompt/response are ever saved.
 *
 * @module local-daily-challenge-store
 * @previewOnly — dev-only / 开发预览 / localStorage fallback / 未调用 LLM
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailyChallengeStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "needs-review";

export interface DailyChallengeState {
  challengeDate: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  status: DailyChallengeStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  recommendationSource: string;
  recommendationReason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAILY_CHALLENGE_KEY = "lap.web.user.dailyChallenge";

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "not-started",
  "in-progress",
  "completed",
  "needs-review",
]);

const VALID_DIFFICULTIES: ReadonlySet<string> = new Set([
  "easy",
  "medium",
  "hard",
  "challenge",
  "入门",
  "基础",
  "中等",
  "困难",
  "挑战",
]);

const MAX_TAG_COUNT = 10;
const MAX_REASON_LENGTH = 500;
const MAX_SOURCE_LENGTH = 200;

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
  /\bjudgeOutput\b/i,
  /\brawJudgeOutput\b/i,
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
// Validation
// ---------------------------------------------------------------------------

export function hasSensitiveFields(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}

export function isValidDailyChallengeStatus(
  s: unknown,
): s is DailyChallengeStatus {
  return typeof s === "string" && VALID_STATUSES.has(s);
}

/**
 * Get today's date string in YYYY-MM-DD format (local timezone).
 */
export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

export function isValidDailyChallengeState(
  entry: unknown,
): entry is DailyChallengeState {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;

  if (typeof e.challengeDate !== "string" || e.challengeDate.length !== 10) return false;
  if (typeof e.problemId !== "string" || e.problemId.length === 0) return false;
  if (typeof e.title !== "string" || e.title.length === 0 || e.title.length > 300) return false;
  if (typeof e.difficulty !== "string" || !VALID_DIFFICULTIES.has(e.difficulty)) return false;
  if (!Array.isArray(e.tags) || e.tags.length === 0 || e.tags.length > MAX_TAG_COUNT) return false;
  if (typeof e.status !== "string" || !VALID_STATUSES.has(e.status)) return false;
  if (e.startedAt !== null && typeof e.startedAt !== "string") return false;
  if (e.startedAt !== null && Number.isNaN(Date.parse(e.startedAt))) return false;
  if (e.completedAt !== null && typeof e.completedAt !== "string") return false;
  if (e.completedAt !== null && Number.isNaN(Date.parse(e.completedAt))) return false;
  if (typeof e.updatedAt !== "string" || Number.isNaN(Date.parse(e.updatedAt))) return false;
  if (typeof e.recommendationSource !== "string" || e.recommendationSource.length === 0 || e.recommendationSource.length > MAX_SOURCE_LENGTH) return false;
  if (typeof e.recommendationReason !== "string" || e.recommendationReason.length === 0 || e.recommendationReason.length > MAX_REASON_LENGTH) return false;

  // No sensitive fields
  if (hasSensitiveFields(entry)) return false;

  // completedAt must be after startedAt if both are set
  if (e.startedAt !== null && e.completedAt !== null) {
    if (new Date(e.completedAt).getTime() < new Date(e.startedAt).getTime()) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// localStorage read/write
// ---------------------------------------------------------------------------

/**
 * Load the current daily challenge state from localStorage.
 * Returns null if no valid state exists or if the saved date is not today.
 */
export function loadDailyChallenge(): DailyChallengeState | null {
  const raw = safeGetItem(DAILY_CHALLENGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemoveItem(DAILY_CHALLENGE_KEY);
    return null;
  }

  if (!isValidDailyChallengeState(parsed)) {
    safeRemoveItem(DAILY_CHALLENGE_KEY);
    return null;
  }

  // Only return state for today
  const state = parsed as DailyChallengeState;
  if (state.challengeDate !== getTodayDateString()) {
    // Stale — clear it
    safeRemoveItem(DAILY_CHALLENGE_KEY);
    return null;
  }

  return state;
}

/**
 * Persist the daily challenge state to localStorage.
 * Refuses to save if the date is not today's date, or if validation fails.
 */
export function persistDailyChallenge(
  state: DailyChallengeState,
): boolean {
  if (!isValidDailyChallengeState(state)) return false;
  if (state.challengeDate !== getTodayDateString()) return false;
  return safeSetItem(DAILY_CHALLENGE_KEY, JSON.stringify(state));
}

/**
 * Clear the daily challenge state from localStorage.
 */
export function clearDailyChallenge(): void {
  safeRemoveItem(DAILY_CHALLENGE_KEY);
}

// ---------------------------------------------------------------------------
// State mutation helpers (pure functions)
// ---------------------------------------------------------------------------

/**
 * Create a new daily challenge state for today with the given problem.
 */
export function createDailyChallenge(params: {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  recommendationSource: string;
  recommendationReason: string;
}): DailyChallengeState {
  return {
    challengeDate: getTodayDateString(),
    problemId: params.problemId,
    title: params.title,
    difficulty: params.difficulty,
    tags: params.tags.slice(0, MAX_TAG_COUNT),
    status: "not-started",
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
    recommendationSource: params.recommendationSource.slice(0, MAX_SOURCE_LENGTH),
    recommendationReason: params.recommendationReason.slice(0, MAX_REASON_LENGTH),
  };
}

/**
 * Mark the daily challenge as started (in-progress).
 */
export function startChallenge(
  state: DailyChallengeState,
): DailyChallengeState {
  return {
    ...state,
    status: "in-progress",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark the daily challenge as completed.
 */
export function completeChallenge(
  state: DailyChallengeState,
): DailyChallengeState {
  return {
    ...state,
    status: "completed",
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark the daily challenge as needs-review.
 */
export function markChallengeNeedsReview(
  state: DailyChallengeState,
): DailyChallengeState {
  return {
    ...state,
    status: "needs-review",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reset the challenge state to not-started (idempotent).
 */
export function resetChallenge(
  state: DailyChallengeState,
): DailyChallengeState {
  return {
    ...state,
    status: "not-started",
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Forbidden label check
// ---------------------------------------------------------------------------

const FORBIDDEN_LABELS = [
  "AI 自动推荐",
  "真实判题已接入",
  "生产每日挑战",
  "云端同步成功",
  "Agent 已运行",
  "LLM 生成",
  "生产可用",
  "真实数据",
  "真实在线判题",
] as const;

export function hasForbiddenLabels(text: string): boolean {
  return FORBIDDEN_LABELS.some((label) => text.includes(label));
}

/**
 * Check that a daily challenge state has no forbidden labels.
 */
export function dailyChallengeStateIsLabelSafe(
  state: DailyChallengeState,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(state);

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push("Forbidden label found: " + label);
    }
  }

  return { safe: violations.length === 0, violations };
}
