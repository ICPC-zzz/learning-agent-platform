import type { LearningReadingProgressSignalStatus } from "./reading-progress-signal-types";
import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";

export type LearningAbilityProfileSaveStatus =
  | "saved"
  | "database_unavailable"
  | "demo_user_missing"
  | "insufficient_data"
  | "calculation_failed"
  | "save_failed"
  | "unavailable_for_mock_fallback"
  | "validation_error";

export interface LearningAbilityProfileSaveResult {
  status: LearningAbilityProfileSaveStatus;
  message: string;
  profileId?: string;
  inputEventCount?: number;
  qaFeedbackSignalCount?: number;
  readingProgressSignalCount: number;
  readingProgressAppliedToSavedProfile: boolean;
  readingProgressStatus: LearningReadingProgressSignalStatus;
  problemAttemptSignalCount: number;
  problemAttemptAppliedToSavedProfile: boolean;
  problemAttemptStatus: LearningProblemAttemptSignalStatus;
  savedAt?: string;
  previewIncludedQaFeedbackSignals: boolean;
}
