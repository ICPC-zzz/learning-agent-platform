export type ReaderQaHistoryReadStatus =
  | "loaded"
  | "empty"
  | "database_unavailable"
  | "demo_user_missing"
  | "unavailable_for_mock_reader"
  | "invalid_reader_context"
  | "read_failed";

export interface ReaderQaHistoryView {
  id: string;
  questionPreview: string;
  answerPreview: string;
  answerSource: string;
  providerLabel: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  errorCategory: string | null;
  createdAt: string;
  createdAtLabel: string;
}

export interface ReaderQaHistoryReadResult {
  status: ReaderQaHistoryReadStatus;
  records: readonly ReaderQaHistoryView[];
  message: string;
}
