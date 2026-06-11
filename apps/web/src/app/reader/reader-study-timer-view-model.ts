/**
 * Reader Study Timer View Model — computes reading timer state and safety
 * for the ReaderStudyTimerControl component.
 *
 * @module reader-study-timer-view-model
 * @previewOnly — dev-only; not production user system
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderStudyTimerState {
  /** Whether a reading session is currently active. */
  isActive: boolean;
  /** Current session ID if active. */
  activeSessionId: string | null;
  /** When the current session started (ISO string). */
  startedAt: string | null;
  /** Accumulated seconds so far. */
  elapsedSeconds: number;
  /** Whether the DB guard is enabled. */
  dbEnabled: boolean;
  /** Data source label. */
  dataSourceLabel: string;
  /** Preset durations for quick selection. */
  presetDurations: number[];
}

export interface ReaderStudyTimerInput {
  /** Whether a reading session is currently active. */
  isActive: boolean;
  /** Current session ID if active. */
  activeSessionId: string | null;
  /** When the current session started (ISO string). */
  startedAt: string | null;
  /** Accumulated seconds so far. */
  elapsedSeconds: number;
  /** Whether DB guard is enabled for reading sessions. */
  dbEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PRESET_MINUTES = [5, 15, 30, 60, 120];

const MAX_DURATION_SECONDS = 28800; // 8 hours

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实数据",
  "云端同步成功",
  "生产学习记录已保存",
  "真实学习系统已完成",
] as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildReaderStudyTimerState(
  input: ReaderStudyTimerInput,
): ReaderStudyTimerState {
  const { isActive, activeSessionId, startedAt, elapsedSeconds, dbEnabled } = input;

  const clampedElapsed = Math.min(
    Math.max(0, Math.trunc(elapsedSeconds)),
    MAX_DURATION_SECONDS,
  );

  let dataSourceLabel: string;
  if (dbEnabled) {
    dataSourceLabel = "阅读计时（开发预览）· dev-only DB · 未接生产账号";
  } else {
    dataSourceLabel = "阅读计时（开发预览）· 本地记录 fallback · 未接生产账号";
  }

  return {
    isActive,
    activeSessionId: isActive ? activeSessionId : null,
    startedAt: isActive ? startedAt : null,
    elapsedSeconds: clampedElapsed,
    dbEnabled,
    dataSourceLabel,
    presetDurations: DEFAULT_PRESET_MINUTES.map((m) => m * 60),
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bfullChapterContent\b/i,
  /\brawText\b/i,
];

export function readerStudyTimerStateIsSafe(
  state: ReaderStudyTimerState,
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

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

export function formatDuration(totalSeconds: number): string {
  const clamped = Math.min(Math.max(0, Math.trunc(totalSeconds)), MAX_DURATION_SECONDS);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatMinutes(totalSeconds: number): string {
  const clamped = Math.min(Math.max(0, Math.trunc(totalSeconds)), MAX_DURATION_SECONDS);
  const minutes = Math.round(clamped / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes} 分钟`;
}
