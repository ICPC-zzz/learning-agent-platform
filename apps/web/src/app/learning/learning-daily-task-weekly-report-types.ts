export interface LearningDailyTaskWeeklyReportBestDayViewModel {
  dateKey: string;
  completionPercent: number;
  completedCount: number;
  totalCount: number;
}

export interface LearningDailyTaskWeeklyReportLatestDayViewModel {
  dateKey: string;
  completionPercent: number;
  latestUpdatedAt: string;
}

export interface LearningDailyTaskWeeklyReportDayOverviewViewModel {
  dateKey: string;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
}

export interface LearningDailyTaskWeeklyReportViewModel {
  available: boolean;
  unavailableReason?: string;
  weekRangeLabel: string;
  activeDays: number;
  totalCompletedCount: number;
  totalTaskCount: number;
  weeklyCompletionPercent: number;
  bestDay?: LearningDailyTaskWeeklyReportBestDayViewModel;
  latestDay?: LearningDailyTaskWeeklyReportLatestDayViewModel;
  dailyOverviews: readonly LearningDailyTaskWeeklyReportDayOverviewViewModel[];
  summaryTitle: string;
  summaryDescription: string;
  suggestions: readonly string[];
  sourceLabel: "本地浏览器记录";
  warning: "开发预览，不写入数据库，不代表真实学习周报";
}
