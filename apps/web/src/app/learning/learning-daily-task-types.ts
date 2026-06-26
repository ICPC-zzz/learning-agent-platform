export type LearningDailyTaskSource = "database" | "empty" | "fallback";

export type LearningDailyTaskType =
  | "reading"
  | "review"
  | "note"
  | "sync"
  | "fallback";

export interface LearningDailyTaskItemViewModel {
  id: string;
  title: string;
  description: string;
  type: LearningDailyTaskType;
  estimateMinutes: number;
  statusLabel: string;
  reason: string;
}

export interface LearningDailyTaskPanelViewModel {
  source: LearningDailyTaskSource;
  sourceLabel: string;
  title: string;
  summary: string;
  tasks: readonly LearningDailyTaskItemViewModel[];
  notes: readonly string[];
  warnings: readonly string[];
  relatedBookId?: string;
  relatedChapterId?: string;
  progressPercent?: string;
}
