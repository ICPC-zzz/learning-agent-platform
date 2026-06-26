import "server-only";

import type {
  ChapterQaProviderErrorCategory,
  ChapterQaProviderRuntimeStatus,
} from "@learning-agent-platform/ai-core";

export interface OpenAiChapterQaProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  status: ChapterQaProviderRuntimeStatus;
}

export type OpenAiChapterQaMessageRole = "system" | "user";

export interface OpenAiChapterQaMessage {
  role: OpenAiChapterQaMessageRole;
  content: string;
}

export interface OpenAiChapterQaPrompt {
  messages: readonly OpenAiChapterQaMessage[];
}

export type OpenAiChapterQaProviderErrorCode = ChapterQaProviderErrorCategory;

export class OpenAiChapterQaProviderError extends Error {
  readonly code: OpenAiChapterQaProviderErrorCode;
  readonly category: ChapterQaProviderErrorCategory;
  readonly networkAttempted: boolean;

  constructor(
    category: ChapterQaProviderErrorCategory,
    networkAttempted: boolean,
  ) {
    super("OpenAI-compatible Chapter Q&A provider failed.");
    this.name = "OpenAiChapterQaProviderError";
    this.code = category;
    this.category = category;
    this.networkAttempted = networkAttempted;
  }
}
