import type {
  AbilityDimension,
  AbilityProfile,
  DifficultyWeights,
  JsonObject,
  ProblemDifficulty,
} from "../scoring/types.js";

export type RecommendationWeakDimension = Exclude<
  AbilityDimension,
  "overall"
>;

export interface RecommendationProblem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  tags: readonly string[];
  source?: string;
  estimatedMinutes?: number;
  metadata?: JsonObject;
}

export interface RecentProblemAttempt {
  problemId: string;
  attemptedAt?: Date;
  isCorrect?: boolean;
}

export interface RecommendationReason {
  code: string;
  message: string;
  weight?: number;
}

export interface RecommendedProblem {
  problem: RecommendationProblem;
  score: number;
  reasons: readonly RecommendationReason[];
}

export interface RecommendationConfig {
  dailyProblemCount: number;
  avoidRecentlyAttempted: boolean;
  recentAttemptWindowDays: number;
  difficultyWeights: DifficultyWeights;
  tagMatchWeight: number;
  weakDimensionTagMap: Record<RecommendationWeakDimension, readonly string[]>;
  fallbackDifficulty: ProblemDifficulty;
}

export interface RecommendationInput {
  abilityProfile: AbilityProfile;
  candidateProblems: readonly RecommendationProblem[];
  recentAttempts?: readonly RecentProblemAttempt[];
  targetDate?: Date;
  config?: Partial<RecommendationConfig>;
}

export interface RecommendationResult {
  recommendedProblems: readonly RecommendedProblem[];
  targetDifficulty: ProblemDifficulty;
  weakDimensions: readonly RecommendationWeakDimension[];
  warnings: readonly string[];
  generatedAt: Date;
}

export type RecommendationStatus =
  | "pending"
  | "accepted"
  | "skipped"
  | "completed";

export interface RecommendationContext {
  abilityProfile: AbilityProfile;
  targetDifficulty: ProblemDifficulty;
  weakDimensions: readonly RecommendationWeakDimension[];
  targetTags: readonly string[];
  recentAttempts: readonly RecentProblemAttempt[];
  targetDate: Date;
  config: RecommendationConfig;
}
