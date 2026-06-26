export type LearningNextStepSuggestionSource = "database" | "empty" | "fallback";

export interface LearningNextStepSuggestionViewModel {
  source: LearningNextStepSuggestionSource;
  sourceLabel: string;
  title: string;
  description: string;
  actionLabel: string;
  reason: string;
  relatedBookId?: string;
  relatedChapterId?: string;
  progressPercent?: string;
  confidenceLabel: string;
  basis: string;
  notes: readonly string[];
  warnings: readonly string[];
}
