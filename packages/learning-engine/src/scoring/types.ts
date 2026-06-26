export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type UnknownRecord = Record<string, unknown>;

export type AbilityDimension =
  | "overall"
  | "algorithm"
  | "debugging"
  | "system_design"
  | "reading";

export type ProblemDifficulty = "easy" | "medium" | "hard";

export interface AbilityDimensionWeights {
  algorithm: number;
  debugging: number;
  systemDesign: number;
  reading: number;
}

export interface DifficultyWeights {
  easy: number;
  medium: number;
  hard: number;
}

export interface AbilityScore {
  dimension: AbilityDimension;
  score: number;
  weight: number;
  eventCount: number;
  confidence: number;
}

export interface AbilityProfile {
  overallScore: number;
  algorithmScore: number;
  debuggingScore: number;
  systemDesignScore: number;
  readingScore: number;
  updatedAt: string;
  confidence: number;
  metadata?: JsonObject;
}

export interface LearningEventBase {
  id?: string;
  userId?: string;
  occurredAt?: string | Date;
  metadata?: JsonObject;
}

export interface ProblemAttemptEvent extends LearningEventBase {
  type: "problem_attempt";
  problemId?: string;
  difficulty: ProblemDifficulty | number;
  isCorrect: boolean;
  timeSpentSeconds?: number;
  tags?: readonly string[];
}

export interface ReadingEvent extends LearningEventBase {
  type: "reading_progress";
  bookId?: string;
  chapterId?: string;
  progressRatio: number;
  timeSpentSeconds?: number;
}

export interface ChapterQuestionEvent extends LearningEventBase {
  type: "chapter_question";
  bookId?: string;
  chapterId?: string;
  questionLength: number;
  answerHelpfulnessRating?: number;
}

export type LearningEvent =
  | ProblemAttemptEvent
  | ReadingEvent
  | ChapterQuestionEvent;

export interface AbilityScoringConfig {
  baseScore: number;
  minScore: number;
  maxScore: number;
  previousProfileWeight: number;
  eventScoreWeight: number;
  dimensionWeights: AbilityDimensionWeights;
  difficultyWeights: DifficultyWeights;
  recencyHalfLifeDays: number;
  recencyMinWeight: number;
  maxConfidenceEventCount: number;
  questionLengthTarget: number;
}

export interface AbilityScoringInput {
  previousProfile?: AbilityProfile;
  events: readonly LearningEvent[];
  config?: Partial<AbilityScoringConfig>;
}

export interface AbilityDimensionBreakdown extends AbilityScore {
  reasons: readonly string[];
}

export type AbilityDimensionBreakdownMap = Record<
  AbilityDimension,
  AbilityDimensionBreakdown
>;

export interface AbilityScoringResult {
  profile: AbilityProfile;
  eventCount: number;
  dimensionBreakdown: AbilityDimensionBreakdownMap;
  warnings: readonly string[];
}
