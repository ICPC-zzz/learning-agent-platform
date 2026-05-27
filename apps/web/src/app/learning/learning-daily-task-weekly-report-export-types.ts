export interface LearningDailyTaskWeeklyReportExportViewModel {
  available: boolean;
  unavailableReason?: string;
  markdownText: string;
  weekRangeLabel: string;
  generatedAt: string;
  sourceLabel: "本地浏览器记录";
  warning: "开发预览，不写入数据库，不代表真实学习周报";
  canCopy: boolean;
  canDownload: boolean;
}
