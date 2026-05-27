import { LearningDailyTaskStatsPanelClient } from "./LearningDailyTaskStatsPanelClient";
import type { LearningDailyTaskPanelViewModel } from "../learning-daily-task-types";

interface LearningDailyTaskStatsPanelProps {
  dailyTask: LearningDailyTaskPanelViewModel;
}

export function LearningDailyTaskStatsPanel({
  dailyTask,
}: LearningDailyTaskStatsPanelProps) {
  return <LearningDailyTaskStatsPanelClient dailyTask={dailyTask} />;
}
