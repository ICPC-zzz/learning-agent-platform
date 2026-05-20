import type {
  ProblemAttemptCorrectness,
  ProblemAttemptStatus,
  ProblemDifficulty,
} from "@prisma/client";

import type { ProblemAttemptRecord } from "./problem-attempt-repository.js";

export type ProblemAttemptLearningEventJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type ProblemAttemptLearningEventJsonValue =
  | ProblemAttemptLearningEventJsonPrimitive
  | ProblemAttemptLearningEventJsonObject
  | ProblemAttemptLearningEventJsonValue[];

export interface ProblemAttemptLearningEventJsonObject {
  [key: string]: ProblemAttemptLearningEventJsonValue;
}

export type ProblemAttemptLearningDifficulty =
  | "easy"
  | "medium"
  | "hard"
  | number;

export interface ProblemAttemptLearningEvent {
  id?: string;
  userId?: string;
  occurredAt?: string | Date;
  metadata?: ProblemAttemptLearningEventJsonObject;
  type: "problem_attempt";
  problemId?: string;
  difficulty: ProblemAttemptLearningDifficulty;
  isCorrect: boolean;
  timeSpentSeconds?: number;
  tags?: readonly string[];
}

export function mapProblemAttemptToLearningEvent(
  record: ProblemAttemptRecord,
): ProblemAttemptLearningEvent | null {
  const difficulty = resolveProblemAttemptLearningDifficulty(record);
  const isCorrect = resolveProblemAttemptLearningCorrectness(record);

  if (difficulty === null || isCorrect === null) {
    return null;
  }

  const event: ProblemAttemptLearningEvent = {
    id: record.id,
    userId: record.userId,
    occurredAt: record.attemptedAt,
    metadata: createProblemAttemptLearningEventMetadata(record),
    type: "problem_attempt",
    difficulty,
    isCorrect,
  };
  const problemId = record.problemId ?? record.externalProblemId;
  const timeSpentSeconds = record.timeSpentSeconds ?? undefined;
  const tags = resolveProblemAttemptLearningTags(record);

  if (problemId !== null && problemId !== undefined) {
    event.problemId = problemId;
  }

  if (timeSpentSeconds !== undefined) {
    event.timeSpentSeconds = timeSpentSeconds;
  }

  if (tags.length > 0) {
    event.tags = tags;
  }

  return event;
}

export function mapProblemAttemptsToLearningEvents(
  records: readonly ProblemAttemptRecord[],
): ProblemAttemptLearningEvent[] {
  return records
    .map((record) => mapProblemAttemptToLearningEvent(record))
    .filter(
      (event): event is ProblemAttemptLearningEvent => event !== null,
    );
}

function resolveProblemAttemptLearningDifficulty(
  record: ProblemAttemptRecord,
): ProblemAttemptLearningDifficulty | null {
  const difficulty = record.difficulty ?? record.problem?.difficulty;

  if (difficulty === null || difficulty === undefined) {
    return null;
  }

  return mapProblemDifficultyToLearningDifficulty(difficulty);
}

function mapProblemDifficultyToLearningDifficulty(
  difficulty: ProblemDifficulty,
): ProblemAttemptLearningDifficulty {
  switch (difficulty) {
    case "EASY":
      return "easy";
    case "MEDIUM":
      return "medium";
    case "HARD":
    case "CHALLENGE":
      return "hard";
  }
}

function resolveProblemAttemptLearningCorrectness(
  record: ProblemAttemptRecord,
): boolean | null {
  const correctness = mapCorrectnessToBoolean(record.correctness);

  if (correctness !== null) {
    return correctness;
  }

  return mapStatusToBoolean(record.status);
}

function mapCorrectnessToBoolean(
  correctness: ProblemAttemptCorrectness,
): boolean | null {
  switch (correctness) {
    case "CORRECT":
      return true;
    case "INCORRECT":
    case "PARTIAL":
      return false;
    case "UNKNOWN":
      return null;
  }
}

function mapStatusToBoolean(status: ProblemAttemptStatus): boolean | null {
  switch (status) {
    case "SOLVED":
      return true;
    case "FAILED":
      return false;
    case "ATTEMPTED":
    case "SKIPPED":
      return null;
  }
}

function resolveProblemAttemptLearningTags(
  record: ProblemAttemptRecord,
): string[] {
  const tags = [...record.topicTags, ...(record.problem?.tags ?? [])];

  return tags.filter((tag, index) => tags.indexOf(tag) === index);
}

function createProblemAttemptLearningEventMetadata(
  record: ProblemAttemptRecord,
): ProblemAttemptLearningEventJsonObject {
  const metadata: ProblemAttemptLearningEventJsonObject =
    isProblemAttemptLearningEventJsonObject(record.metadata)
      ? { ...record.metadata }
      : {};

  metadata.source = record.source;
  metadata.status = record.status;
  metadata.correctness = record.correctness;
  metadata.attemptedAt = record.attemptedAt.toISOString();

  if (record.problemId !== null) {
    metadata.problemId = record.problemId;
  }

  if (record.externalProblemId !== null) {
    metadata.externalProblemId = record.externalProblemId;
  }

  return metadata;
}

function isProblemAttemptLearningEventJsonValue(
  value: unknown,
): value is ProblemAttemptLearningEventJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isProblemAttemptLearningEventJsonValue);
  }

  return isProblemAttemptLearningEventJsonObject(value);
}

function isProblemAttemptLearningEventJsonObject(
  value: unknown,
): value is ProblemAttemptLearningEventJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isProblemAttemptLearningEventJsonValue);
}
