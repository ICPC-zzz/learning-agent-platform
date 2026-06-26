import type { LearningDailyTaskPanelViewModel } from "./learning-daily-task-types";

export const LEARNING_DAILY_TASK_STORAGE_PREFIX = "lap.learning.dailyTasks";
export const LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT =
  "lap.learning.dailyTasks.changed";
const DEFAULT_SCAN_LIMIT = 20;

export interface LearningDailyTaskLocalState {
  dateKey: string;
  contextKey: string;
  completedTaskIds: string[];
  updatedAt: string;
  totalTaskCount?: number;
}

export interface LearningDailyTaskStorageContext {
  dateKey: string;
  contextKey: string;
  storageKey: string;
}

export interface LearningDailyTaskLocalStateRecord
  extends LearningDailyTaskLocalState {
  storageKey: string;
}

export function createLearningDailyTaskStorageContext(
  dailyTask: Pick<
    LearningDailyTaskPanelViewModel,
    "source" | "relatedBookId" | "relatedChapterId"
  >,
  now: Date = new Date(),
): LearningDailyTaskStorageContext {
  const dateKey = formatDateKey(now);
  const contextKey = [
    dailyTask.source,
    dailyTask.relatedBookId ?? "none",
    dailyTask.relatedChapterId ?? "none",
  ].join(".");

  return {
    dateKey,
    contextKey,
    storageKey: `${LEARNING_DAILY_TASK_STORAGE_PREFIX}.${dateKey}.${contextKey}`,
  };
}

export function readLearningDailyTaskLocalState(
  context: LearningDailyTaskStorageContext,
): LearningDailyTaskLocalState | null {
  const storage = getLocalStorage();

  if (storage === null) {
    return null;
  }

  try {
    const raw = storage.getItem(context.storageKey);

    if (!raw) {
      return null;
    }

    const parsed = parseLearningDailyTaskLocalState(raw);

    if (
      parsed === null ||
      parsed.dateKey !== context.dateKey ||
      parsed.contextKey !== context.contextKey
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveLearningDailyTaskLocalState(
  context: LearningDailyTaskStorageContext,
  completedTaskIds: readonly string[],
  now: Date = new Date(),
  totalTaskCount?: number,
): LearningDailyTaskLocalState | null {
  const storage = getLocalStorage();

  if (storage === null) {
    return null;
  }

  const nextState: LearningDailyTaskLocalState = {
    dateKey: context.dateKey,
    contextKey: context.contextKey,
    completedTaskIds: [...new Set(completedTaskIds)],
    updatedAt: now.toISOString(),
    totalTaskCount: normalizeTotalTaskCount(totalTaskCount),
  };

  try {
    storage.setItem(context.storageKey, JSON.stringify(nextState));
    notifyLearningDailyTaskLocalStateChanged(context, nextState);

    return nextState;
  } catch {
    return null;
  }
}

export function listLearningDailyTaskLocalStateRecords({
  maxRecords = DEFAULT_SCAN_LIMIT,
}: {
  maxRecords?: number;
} = {}): LearningDailyTaskLocalStateRecord[] | null {
  const storage = getLocalStorage();

  if (storage === null) {
    return null;
  }

  const records: LearningDailyTaskLocalStateRecord[] = [];
  const normalizedLimit = normalizeScanLimit(maxRecords);
  const prefix = `${LEARNING_DAILY_TASK_STORAGE_PREFIX}.`;
  let scannedMatchedCount = 0;

  for (
    let index = storage.length - 1;
    index >= 0 && scannedMatchedCount < normalizedLimit;
    index -= 1
  ) {
    const key = storage.key(index);

    if (key === null || !key.startsWith(prefix)) {
      continue;
    }

    scannedMatchedCount += 1;

    try {
      const raw = storage.getItem(key);

      if (!raw) {
        continue;
      }

      const parsed = parseLearningDailyTaskLocalState(raw);

      if (parsed === null) {
        continue;
      }

      records.push({
        ...parsed,
        storageKey: key,
      });
    } catch {
      continue;
    }
  }

  return records;
}

export function isLearningDailyTaskLocalStorageAvailable(): boolean {
  return getLocalStorage() !== null;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeScanLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_SCAN_LIMIT;
  }

  return value;
}

function parseLearningDailyTaskLocalState(
  raw: string,
): LearningDailyTaskLocalState | null {
  const parsed = JSON.parse(raw) as Partial<LearningDailyTaskLocalState>;

  if (
    typeof parsed.dateKey !== "string" ||
    typeof parsed.contextKey !== "string" ||
    !Array.isArray(parsed.completedTaskIds) ||
    typeof parsed.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    dateKey: parsed.dateKey,
    contextKey: parsed.contextKey,
    completedTaskIds: parsed.completedTaskIds.filter(
      (taskId): taskId is string => typeof taskId === "string",
    ),
    updatedAt: parsed.updatedAt,
    totalTaskCount: normalizeTotalTaskCount(parsed.totalTaskCount),
  };
}

function normalizeTotalTaskCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
}

function notifyLearningDailyTaskLocalStateChanged(
  context: LearningDailyTaskStorageContext,
  state: LearningDailyTaskLocalState,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT, {
        detail: {
          storageKey: context.storageKey,
          dateKey: state.dateKey,
          contextKey: state.contextKey,
          updatedAt: state.updatedAt,
        },
      }),
    );
  } catch {
    // Ignore event dispatch errors to avoid blocking UI interactions.
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
