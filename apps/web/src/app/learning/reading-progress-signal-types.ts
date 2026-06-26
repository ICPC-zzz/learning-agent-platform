import type { ReadingEvent } from "@learning-agent-platform/learning-engine";

export type LearningReadingProgressSignalStatus =
  | "progress_loaded"
  | "progress_empty"
  | "demo_user_missing"
  | "database_unavailable"
  | "read_failed"
  | "unavailable";

export interface LearningReadingProgressSignalPreview {
  status: LearningReadingProgressSignalStatus;
  message: string;
  progressCount: number;
  completedChapterCount: number;
  activeBookCount: number;
  latestProgressUpdatedAt?: string;
  mappedSignalCount: number;
  previewAppliedToAbility: boolean;
  learningEvents: readonly ReadingEvent[];
}
