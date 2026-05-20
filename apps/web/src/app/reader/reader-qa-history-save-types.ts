export type ReaderQaReaderDataSource = "database" | "mock_fallback";

export interface ReaderQaReaderIdentity {
  bookId?: string | null;
  chapterId?: string | null;
  readerDataSource: ReaderQaReaderDataSource;
}

export type ReaderQaHistorySaveStatus =
  | "saved"
  | "skipped_mock_reader"
  | "skipped_no_answer"
  | "database_unavailable"
  | "demo_user_missing"
  | "invalid_reader_context"
  | "save_failed";

export interface ReaderQaHistorySaveResult {
  status: ReaderQaHistorySaveStatus;
  message: string;
  historyRecordId?: string;
}

export function createSkippedNoAnswerHistorySaveResult(): ReaderQaHistorySaveResult {
  return {
    status: "skipped_no_answer",
    message: "Q&A history was not saved because no answer text was available.",
  };
}
