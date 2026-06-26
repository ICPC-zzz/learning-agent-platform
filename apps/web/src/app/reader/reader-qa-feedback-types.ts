import type { ChapterQaFeedbackRating } from "@learning-agent-platform/db";

export type ReaderQaFeedbackRating = ChapterQaFeedbackRating;

export type ReaderQaFeedbackSaveStatus =
  | "saved"
  | "database_unavailable"
  | "demo_user_missing"
  | "invalid_history_record"
  | "validation_error"
  | "save_failed";

export interface ReaderQaFeedbackSaveInput {
  historyRecordId: string;
  rating: ReaderQaFeedbackRating;
  note?: string | null;
}

export type ReaderQaFeedbackSaveResult =
  | {
      status: "saved";
      message: string;
      historyRecordId: string;
      rating: ReaderQaFeedbackRating;
      savedAt: string;
    }
  | {
      status: Exclude<ReaderQaFeedbackSaveStatus, "saved">;
      message: string;
      historyRecordId?: string;
      rating?: ReaderQaFeedbackRating;
    };

export function isReaderQaFeedbackRating(
  value: unknown,
): value is ReaderQaFeedbackRating {
  return value === "helpful" || value === "unhelpful" || value === "neutral";
}
