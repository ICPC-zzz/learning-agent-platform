import { LearningDailyTaskPanelClient } from "./LearningDailyTaskPanelClient";
import type { LearningDailyTaskPanelViewModel } from "../learning-daily-task-types";

interface LearningDailyTaskPanelProps {
  dailyTask: LearningDailyTaskPanelViewModel;
}

export function LearningDailyTaskPanel({ dailyTask }: LearningDailyTaskPanelProps) {
  return <LearningDailyTaskPanelClient dailyTask={dailyTask} />;
}
