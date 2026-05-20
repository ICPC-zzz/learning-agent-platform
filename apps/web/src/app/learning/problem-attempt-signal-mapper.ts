import {
  mapProblemAttemptToLearningEvent,
  type ProblemAttemptRecord,
} from "@learning-agent-platform/db";
import type {
  JsonObject,
  JsonValue,
  ProblemAttemptEvent,
} from "@learning-agent-platform/learning-engine";

export interface ProblemAttemptSignalRecordSummary {
  attemptCount: number;
  recentAttemptCount: number;
  solvedCount: number;
  failedCount: number;
  attemptedOnlyCount: number;
  latestAttemptAt?: string;
}

export function mapProblemAttemptRecordToLearningEvent(
  record: ProblemAttemptRecord,
): ProblemAttemptEvent | null {
  const mappedEvent = mapProblemAttemptToLearningEvent(record);

  if (mappedEvent === null) {
    return null;
  }

  const event: ProblemAttemptEvent = {
    type: "problem_attempt",
    difficulty: mappedEvent.difficulty,
    isCorrect: mappedEvent.isCorrect,
  };

  if (mappedEvent.id !== undefined) {
    event.id = mappedEvent.id;
  }

  if (mappedEvent.userId !== undefined) {
    event.userId = mappedEvent.userId;
  }

  if (mappedEvent.occurredAt !== undefined) {
    event.occurredAt = mappedEvent.occurredAt;
  }

  if (mappedEvent.problemId !== undefined) {
    event.problemId = mappedEvent.problemId;
  }

  if (mappedEvent.timeSpentSeconds !== undefined) {
    event.timeSpentSeconds = mappedEvent.timeSpentSeconds;
  }

  if (mappedEvent.tags !== undefined) {
    event.tags = mappedEvent.tags;
  }

  const metadata = toLearningJsonObject(mappedEvent.metadata);

  if (metadata !== undefined) {
    event.metadata = metadata;
  }

  return event;
}

export function mapProblemAttemptRecordsToLearningEvents(
  records: readonly ProblemAttemptRecord[],
): readonly ProblemAttemptEvent[] {
  return records
    .map((record) => mapProblemAttemptRecordToLearningEvent(record))
    .filter(
      (event): event is ProblemAttemptEvent => event !== null,
    );
}

export function summarizeProblemAttemptRecords(
  records: readonly ProblemAttemptRecord[],
): ProblemAttemptSignalRecordSummary {
  let solvedCount = 0;
  let failedCount = 0;
  let attemptedOnlyCount = 0;
  let latestAttemptAt: Date | undefined;

  for (const record of records) {
    switch (record.status) {
      case "SOLVED":
        solvedCount += 1;
        break;
      case "FAILED":
        failedCount += 1;
        break;
      case "ATTEMPTED":
        attemptedOnlyCount += 1;
        break;
      case "SKIPPED":
        break;
    }

    if (
      latestAttemptAt === undefined ||
      record.attemptedAt.getTime() > latestAttemptAt.getTime()
    ) {
      latestAttemptAt = record.attemptedAt;
    }
  }

  return {
    attemptCount: records.length,
    recentAttemptCount: records.length,
    solvedCount,
    failedCount,
    attemptedOnlyCount,
    latestAttemptAt: latestAttemptAt?.toISOString(),
  };
}

function toLearningJsonObject(value: unknown): JsonObject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const output: JsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    const jsonValue = toLearningJsonValue(item);

    if (jsonValue !== undefined) {
      output[key] = jsonValue;
    }
  }

  return output;
}

function toLearningJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const items: JsonValue[] = [];

    for (const item of value) {
      const jsonValue = toLearningJsonValue(item);

      if (jsonValue === undefined) {
        return undefined;
      }

      items.push(jsonValue);
    }

    return items;
  }

  return toLearningJsonObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
