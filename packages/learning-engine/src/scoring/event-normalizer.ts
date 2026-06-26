import type {
  ChapterQuestionEvent,
  JsonObject,
  JsonValue,
  LearningEvent,
  LearningEventBase,
  ProblemAttemptEvent,
  ProblemDifficulty,
  ReadingEvent,
  UnknownRecord,
} from "./types.js";

export interface NormalizedLearningEvents {
  events: readonly LearningEvent[];
  warnings: readonly string[];
  ignoredCount: number;
}

const VALID_DIFFICULTIES: readonly ProblemDifficulty[] = [
  "easy",
  "medium",
  "hard",
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function normalizeDifficulty(
  value: unknown,
): ProblemDifficulty | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (VALID_DIFFICULTIES.includes(normalized as ProblemDifficulty)) {
    return normalized as ProblemDifficulty;
  }

  return undefined;
}

function normalizeTags(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return tags.length > 0 ? tags : undefined;
}

function readOptionalString(
  record: UnknownRecord,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readOptionalNonNegativeNumber(
  record: UnknownRecord,
  key: string,
): number | undefined {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function normalizeBaseFields(
  record: UnknownRecord,
  warnings: string[],
): LearningEventBase {
  const base: LearningEventBase = {};
  const id = readOptionalString(record, "id");
  const userId = readOptionalString(record, "userId");
  const occurredAt = record.occurredAt;

  if (id !== undefined) {
    base.id = id;
  }

  if (userId !== undefined) {
    base.userId = userId;
  }

  if (typeof occurredAt === "string") {
    const parsed = new Date(occurredAt);
    if (isValidDate(parsed)) {
      base.occurredAt = occurredAt;
    } else {
      warnings.push("invalid_occurred_at_ignored");
    }
  } else if (occurredAt instanceof Date) {
    if (isValidDate(occurredAt)) {
      base.occurredAt = occurredAt;
    } else {
      warnings.push("invalid_occurred_at_ignored");
    }
  }

  if (isJsonObject(record.metadata)) {
    base.metadata = record.metadata;
  }

  return base;
}

function normalizeProblemAttemptEvent(
  record: UnknownRecord,
  warnings: string[],
): ProblemAttemptEvent | undefined {
  const difficulty = normalizeDifficulty(record.difficulty);

  if (difficulty === undefined || typeof record.isCorrect !== "boolean") {
    warnings.push("invalid_problem_attempt_ignored");
    return undefined;
  }

  const event: ProblemAttemptEvent = {
    ...normalizeBaseFields(record, warnings),
    type: "problem_attempt",
    difficulty,
    isCorrect: record.isCorrect,
  };
  const problemId = readOptionalString(record, "problemId");
  const timeSpentSeconds = readOptionalNonNegativeNumber(
    record,
    "timeSpentSeconds",
  );
  const tags = normalizeTags(record.tags);

  if (problemId !== undefined) {
    event.problemId = problemId;
  }

  if (timeSpentSeconds !== undefined) {
    event.timeSpentSeconds = timeSpentSeconds;
  }

  if (tags !== undefined) {
    event.tags = tags;
  }

  return event;
}

function normalizeReadingEvent(
  record: UnknownRecord,
  warnings: string[],
): ReadingEvent | undefined {
  if (
    typeof record.progressRatio !== "number" ||
    !Number.isFinite(record.progressRatio)
  ) {
    warnings.push("invalid_reading_progress_ignored");
    return undefined;
  }

  if (record.progressRatio < 0 || record.progressRatio > 1) {
    warnings.push("reading_progress_ratio_clamped");
  }

  const event: ReadingEvent = {
    ...normalizeBaseFields(record, warnings),
    type: "reading_progress",
    progressRatio: record.progressRatio,
  };
  const bookId = readOptionalString(record, "bookId");
  const chapterId = readOptionalString(record, "chapterId");
  const timeSpentSeconds = readOptionalNonNegativeNumber(
    record,
    "timeSpentSeconds",
  );

  if (bookId !== undefined) {
    event.bookId = bookId;
  }

  if (chapterId !== undefined) {
    event.chapterId = chapterId;
  }

  if (timeSpentSeconds !== undefined) {
    event.timeSpentSeconds = timeSpentSeconds;
  }

  return event;
}

function normalizeChapterQuestionEvent(
  record: UnknownRecord,
  warnings: string[],
): ChapterQuestionEvent | undefined {
  if (
    typeof record.questionLength !== "number" ||
    !Number.isFinite(record.questionLength) ||
    record.questionLength <= 0
  ) {
    warnings.push("invalid_chapter_question_ignored");
    return undefined;
  }

  const event: ChapterQuestionEvent = {
    ...normalizeBaseFields(record, warnings),
    type: "chapter_question",
    questionLength: record.questionLength,
  };
  const bookId = readOptionalString(record, "bookId");
  const chapterId = readOptionalString(record, "chapterId");
  const answerHelpfulnessRating = record.answerHelpfulnessRating;

  if (bookId !== undefined) {
    event.bookId = bookId;
  }

  if (chapterId !== undefined) {
    event.chapterId = chapterId;
  }

  if (
    typeof answerHelpfulnessRating === "number" &&
    Number.isFinite(answerHelpfulnessRating)
  ) {
    event.answerHelpfulnessRating = answerHelpfulnessRating;
  }

  return event;
}

export function normalizeLearningEvents(
  events: readonly LearningEvent[],
): NormalizedLearningEvents {
  const normalizedEvents: LearningEvent[] = [];
  const warnings: string[] = [];
  let ignoredCount = 0;

  for (const event of events) {
    if (!isRecord(event) || typeof event.type !== "string") {
      warnings.push("invalid_event_ignored");
      ignoredCount += 1;
      continue;
    }

    let normalizedEvent: LearningEvent | undefined;

    if (event.type === "problem_attempt") {
      normalizedEvent = normalizeProblemAttemptEvent(event, warnings);
    } else if (event.type === "reading_progress") {
      normalizedEvent = normalizeReadingEvent(event, warnings);
    } else if (event.type === "chapter_question") {
      normalizedEvent = normalizeChapterQuestionEvent(event, warnings);
    } else {
      warnings.push("unsupported_event_type_ignored");
    }

    if (normalizedEvent === undefined) {
      ignoredCount += 1;
    } else {
      normalizedEvents.push(normalizedEvent);
    }
  }

  return {
    events: normalizedEvents,
    warnings,
    ignoredCount,
  };
}

export function getEventOccurredAt(event: LearningEvent): Date | undefined {
  if (event.occurredAt === undefined) {
    return undefined;
  }

  const occurredAt =
    event.occurredAt instanceof Date
      ? event.occurredAt
      : new Date(event.occurredAt);

  return isValidDate(occurredAt) ? occurredAt : undefined;
}

export function filterProblemAttemptEvents(
  events: readonly LearningEvent[],
): ProblemAttemptEvent[] {
  return events.filter(
    (event): event is ProblemAttemptEvent => event.type === "problem_attempt",
  );
}

export function filterReadingEvents(
  events: readonly LearningEvent[],
): ReadingEvent[] {
  return events.filter(
    (event): event is ReadingEvent => event.type === "reading_progress",
  );
}

export function filterChapterQuestionEvents(
  events: readonly LearningEvent[],
): ChapterQuestionEvent[] {
  return events.filter(
    (event): event is ChapterQuestionEvent =>
      event.type === "chapter_question",
  );
}
