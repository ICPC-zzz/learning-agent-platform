export interface LearningDailyTaskHistoryDayViewModel {
  dateKey: string;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  contextCount: number;
  latestUpdatedAt: string | null;
}

export interface LearningDailyTaskHistoryLatestRecordViewModel {
  dateKey: string;
  contextKey: string;
  completedCount: number;
  totalCount: number;
  updatedAt: string;
}

export interface LearningDailyTaskHistoryViewModel {
  available: boolean;
  unavailableReason?: string;
  totalRecords: number;
  recentDays: readonly LearningDailyTaskHistoryDayViewModel[];
  bestDay?: LearningDailyTaskHistoryDayViewModel;
  latestRecord?: LearningDailyTaskHistoryLatestRecordViewModel;
  sourceLabel: string;
  warning: string;
}
