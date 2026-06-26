"use server";

import { recomputeAndSaveLearningAbilityProfile } from "./learning-ability-profile-save";
import type { LearningAbilityProfileSaveResult } from "./learning-ability-profile-save-types";
import { recomputeAndSaveDailyRecommendation } from "./learning-daily-recommendation-save";
import type { LearningDailyRecommendationSaveResult } from "./learning-daily-recommendation-save-types";
import { saveRecommendedProblemAttempt } from "./learning-problem-attempt-save";
import type {
  LearningProblemAttemptSaveInput,
  LearningProblemAttemptSaveResult,
} from "./learning-problem-attempt-save-types";

export async function saveCurrentLearningAbilityProfileAction(): Promise<LearningAbilityProfileSaveResult> {
  return recomputeAndSaveLearningAbilityProfile();
}

export async function saveCurrentDailyRecommendationAction(): Promise<LearningDailyRecommendationSaveResult> {
  return recomputeAndSaveDailyRecommendation();
}

export async function saveRecommendedProblemAttemptAction(
  input: LearningProblemAttemptSaveInput,
): Promise<LearningProblemAttemptSaveResult> {
  return saveRecommendedProblemAttempt(input);
}
