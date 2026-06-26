import type {
  ChapterQaFeedbackLearningEvent,
  ChapterQaFeedbackLearningSignal,
} from "@learning-agent-platform/learning-engine";

export type LearningQaFeedbackSignalLoadStatus =
  | "loaded"
  | "empty"
  | "database_unavailable"
  | "demo_user_missing"
  | "read_failed";

export interface LearningQaFeedbackSignalFeedbackCounts {
  helpful: number;
  neutral: number;
  unhelpful: number;
}

export interface LearningQaFeedbackSignalAnswerSourceCounts {
  mock: number;
  real_openai: number;
  fallback_mock: number;
}

export interface LearningQaFeedbackSignalConfidenceSummary {
  averageConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  fallbackAffectedCount: number;
  providerErrorCount: number;
}

export type LearningQaFeedbackAbilityPreviewImpactStatus =
  | "included"
  | "not_included";

export interface LearningQaFeedbackAbilityPreviewImpact {
  status: LearningQaFeedbackAbilityPreviewImpactStatus;
  message: string;
}

export interface LearningQaFeedbackSignalPreview {
  status: LearningQaFeedbackSignalLoadStatus;
  recordsLoaded: number;
  validSignalCount: number;
  feedbackCounts: LearningQaFeedbackSignalFeedbackCounts;
  answerSourceCounts: LearningQaFeedbackSignalAnswerSourceCounts;
  confidenceSummary: LearningQaFeedbackSignalConfidenceSummary;
  signalReasons: readonly string[];
  learningEvents: readonly ChapterQaFeedbackLearningEvent[];
  signals: readonly ChapterQaFeedbackLearningSignal[];
  message: string;
  abilityPreviewImpact: LearningQaFeedbackAbilityPreviewImpact;
}
