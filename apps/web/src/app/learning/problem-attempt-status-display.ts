import type { ProblemAttemptRecord } from "@learning-agent-platform/db";

export type LearningProblemAttemptDisplayStatus =
  | "attempted"
  | "solved"
  | "failed";

export type LearningProblemAttemptStatusDisplayLabel =
  | LearningProblemAttemptDisplayStatus
  | "not_attempted"
  | "unavailable"
  | "read_failed"
  | "demo_user_missing"
  | "database_unavailable";

export function mapProblemAttemptRecordStatusToDisplayStatus(
  record: Pick<ProblemAttemptRecord, "status">,
): LearningProblemAttemptDisplayStatus {
  switch (record.status) {
    case "SOLVED":
      return "solved";
    case "FAILED":
      return "failed";
    case "ATTEMPTED":
    case "SKIPPED":
      return "attempted";
  }
}

export function formatProblemAttemptStatusLabel(
  status: LearningProblemAttemptStatusDisplayLabel,
): string {
  switch (status) {
    case "not_attempted":
      return "未尝试";
    case "attempted":
      return "已尝试";
    case "solved":
      return "已解决";
    case "failed":
      return "失败";
    case "unavailable":
      return "不可用";
    case "read_failed":
      return "读取失败";
    case "demo_user_missing":
      return "缺少演示用户";
    case "database_unavailable":
      return "数据库不可用";
  }
}
