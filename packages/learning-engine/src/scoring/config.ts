import type { AbilityScoringConfig } from "./types.js";

export const DEFAULT_ABILITY_SCORING_CONFIG: AbilityScoringConfig = {
  baseScore: 50,
  minScore: 0,
  maxScore: 100,
  previousProfileWeight: 0.75,
  eventScoreWeight: 0.25,
  dimensionWeights: {
    algorithm: 0.4,
    debugging: 0.25,
    systemDesign: 0.2,
    reading: 0.15,
  },
  difficultyWeights: {
    easy: 0.8,
    medium: 1,
    hard: 1.25,
  },
  recencyHalfLifeDays: 30,
  recencyMinWeight: 0.35,
  maxConfidenceEventCount: 20,
  questionLengthTarget: 120,
};
