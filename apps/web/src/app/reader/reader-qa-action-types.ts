import type {
  ChapterQaAnswer,
  ChapterQaFallbackReason,
  ChapterQaContext,
  ChapterQaProviderErrorCategory,
  ChapterQaProviderMode,
  ChapterQaProviderRuntimeStatus,
} from "@learning-agent-platform/ai-core";
import { mockChapterQaProviderStatus } from "@learning-agent-platform/ai-core";

import type {
  ReaderQaHistorySaveResult,
  ReaderQaReaderIdentity,
} from "./reader-qa-history-save-types";

export type ReaderQaProviderMode = ChapterQaProviderMode;
export type ReaderQaActionProviderStatus = ChapterQaProviderRuntimeStatus;

export interface AskChapterQuestionActionInput {
  question: string;
  context: ChapterQaContext;
  readerIdentity: ReaderQaReaderIdentity;
  providerMode?: ReaderQaProviderMode;
}

export interface ReaderQaValidationIssue {
  field: string;
  message: string;
}

export interface AskChapterQuestionActionSuccess {
  ok: true;
  status: "success";
  answer: ChapterQaAnswer;
  providerStatus: ReaderQaActionProviderStatus;
  historySaveResult: ReaderQaHistorySaveResult;
}

export interface AskChapterQuestionActionFailure {
  ok: false;
  status:
    | "validation_error"
    | "provider_error"
    | "provider_unavailable"
    | "not_configured"
    | "disabled";
  message: string;
  providerStatus: ReaderQaActionProviderStatus;
  fallbackUsed: boolean;
  fallbackReason?: ChapterQaFallbackReason | null;
  errorCategory?: ChapterQaProviderErrorCategory | null;
  fieldErrors?: readonly ReaderQaValidationIssue[];
  historySaveResult: ReaderQaHistorySaveResult;
}

export type AskChapterQuestionActionResult =
  | AskChapterQuestionActionSuccess
  | AskChapterQuestionActionFailure;

export const readerQaActionProviderStatus: ReaderQaActionProviderStatus = {
  ...mockChapterQaProviderStatus,
};
