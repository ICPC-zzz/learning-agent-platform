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
    default:
      return "attempted";
  }
}

export function formatProblemAttemptStatusLabel(
  status: LearningProblemAttemptStatusDisplayLabel,
): string {
  switch (status) {
    case "not_attempted":
      return "\u672A\u5C1D\u8BD5";
    case "attempted":
      return "\u5DF2\u5C1D\u8BD5";
    case "solved":
      return "\u5DF2\u89E3\u51B3";
    case "failed":
      return "\u5931\u8D25";
    case "unavailable":
      return "\u4E0D\u53EF\u7528";
    case "read_failed":
      return "\u8BFB\u53D6\u5931\u8D25";
    case "demo_user_missing":
      return "\u7F3A\u5C11\u6F14\u793A\u7528\u6237";
    case "database_unavailable":
      return "\u6570\u636E\u5E93\u4E0D\u53EF\u7528";
  }
}
