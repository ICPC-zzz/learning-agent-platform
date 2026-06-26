import type { RecommendationConfig } from "./types.js";

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  dailyProblemCount: 5,
  avoidRecentlyAttempted: true,
  recentAttemptWindowDays: 7,
  difficultyWeights: {
    easy: 28,
    medium: 32,
    hard: 30,
  },
  tagMatchWeight: 35,
  weakDimensionTagMap: {
    algorithm: [
      "algorithm",
      "array",
      "string",
      "dynamic-programming",
      "graph",
    ],
    debugging: ["debugging", "implementation", "edge-cases"],
    system_design: ["system-design", "architecture", "scalability"],
    reading: ["fundamentals", "concept-review", "reading-check"],
  },
  fallbackDifficulty: "medium",
};
