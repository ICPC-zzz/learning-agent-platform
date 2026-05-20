import type {
  ChapterQaContext,
  ChapterQaContextChunk,
} from "@learning-agent-platform/ai-core";
import { isChapterQaProviderMode } from "@learning-agent-platform/ai-core";

import type {
  ReaderQaProviderMode,
  ReaderQaValidationIssue,
} from "./reader-qa-action-types";
import type {
  ReaderQaReaderDataSource,
  ReaderQaReaderIdentity,
} from "./reader-qa-history-save-types";

export const readerQaValidationLimits = {
  questionMaxChars: 1000,
  titleMaxChars: 200,
  currentChunkTextMaxChars: 4000,
  visibleTextExcerptMaxChars: 4000,
  nearbyChunkTextMaxChars: 1500,
  nearbyChunksMaxItems: 8,
  nearbyChunksTotalTextMaxChars: 8000,
  summaryMaxChars: 1000,
  chunkIdMaxChars: 120,
} as const;

export interface ValidatedAskChapterQuestionInput {
  question: string;
  context: ChapterQaContext;
  readerIdentity: ReaderQaReaderIdentity;
  providerMode: ReaderQaProviderMode;
}

export type ReaderQaValidationResult =
  | {
      ok: true;
      input: ValidatedAskChapterQuestionInput;
    }
  | {
      ok: false;
      message: string;
      issues: readonly ReaderQaValidationIssue[];
    };

export function readRequestedReaderQaProviderMode(
  input: unknown,
): unknown {
  if (!isRecord(input)) {
    return undefined;
  }

  return input.providerMode;
}

export function validateAskChapterQuestionActionInput(
  input: unknown,
): ReaderQaValidationResult {
  const issues: ReaderQaValidationIssue[] = [];

  if (!isRecord(input)) {
    return createValidationFailure([
      {
        field: "input",
        message: "Ask AI input must be an object.",
      },
    ]);
  }

  const question = readNormalizedString(input.question);

  if (question.length === 0) {
    issues.push({
      field: "question",
      message: "Question is required.",
    });
  } else if (question.length > readerQaValidationLimits.questionMaxChars) {
    issues.push({
      field: "question",
      message: `Question must be ${readerQaValidationLimits.questionMaxChars} characters or fewer.`,
    });
  }

  const rawContext = input.context;

  if (!isRecord(rawContext)) {
    issues.push({
      field: "context",
      message: "Reader context is required.",
    });

    return createValidationFailure(issues);
  }

  const providerMode = readProviderMode(input.providerMode, issues);

  const bookTitle = readRequiredLimitedText(
    rawContext,
    "bookTitle",
    "context.bookTitle",
    readerQaValidationLimits.titleMaxChars,
    issues,
  );
  const chapterTitle = readRequiredLimitedText(
    rawContext,
    "chapterTitle",
    "context.chapterTitle",
    readerQaValidationLimits.titleMaxChars,
    issues,
  );
  const currentChunkText = truncateText(
    readNormalizedString(rawContext.currentChunkText),
    readerQaValidationLimits.currentChunkTextMaxChars,
  ).text;
  const visibleTextExcerpt = truncateText(
    readNormalizedString(rawContext.visibleTextExcerpt),
    readerQaValidationLimits.visibleTextExcerptMaxChars,
  ).text;

  if (currentChunkText.length === 0 && visibleTextExcerpt.length === 0) {
    issues.push({
      field: "context.currentChunkText",
      message:
        "Reader context must include current chunk text or an equivalent excerpt.",
    });
  }

  const contextSource = readNormalizedString(rawContext.contextSource);

  if (contextSource !== "current_reader_context") {
    issues.push({
      field: "context.contextSource",
      message: "Reader context source must be current_reader_context.",
    });
  }

  if (issues.length > 0) {
    return createValidationFailure(issues);
  }

  const nearbyChunks = normalizeNearbyChunks(rawContext.nearbyChunks);
  const totalChunks = Math.max(
    readFiniteInteger(rawContext.totalChunks, nearbyChunks.length),
    nearbyChunks.length,
    currentChunkText.length > 0 || visibleTextExcerpt.length > 0 ? 1 : 0,
  );
  const currentChunkIndex = clampNumber(
    readFiniteInteger(rawContext.currentChunkIndex, 0),
    0,
    Math.max(totalChunks - 1, 0),
  );
  const readingProgressPercent = clampNumber(
    readFiniteInteger(rawContext.readingProgressPercent, 0),
    0,
    100,
  );

  return {
    ok: true,
    input: {
      question,
      providerMode,
      readerIdentity: readReaderIdentity(input.readerIdentity),
      context: {
        userQuestion: question,
        bookTitle,
        chapterTitle,
        currentChunkText,
        visibleTextExcerpt,
        nearbyChunks,
        currentChunkIndex,
        totalChunks,
        readingProgressPercent,
        readingProgressSummary: readOptionalLimitedText(
          rawContext.readingProgressSummary,
          readerQaValidationLimits.summaryMaxChars,
          "No reader progress summary was provided.",
        ),
        abilityProfileSummary: readOptionalLimitedText(
          rawContext.abilityProfileSummary,
          readerQaValidationLimits.summaryMaxChars,
          "No ability profile summary was provided.",
        ),
        contextSource: "current_reader_context",
      },
    },
  };
}

function readReaderIdentity(value: unknown): ReaderQaReaderIdentity {
  if (!isRecord(value)) {
    return {
      readerDataSource: "mock_fallback",
    };
  }

  return {
    bookId: normalizeOptionalIdentityText(value.bookId),
    chapterId: normalizeOptionalIdentityText(value.chapterId),
    readerDataSource: readReaderDataSource(value.readerDataSource),
  };
}

function readReaderDataSource(value: unknown): ReaderQaReaderDataSource {
  const normalized = readNormalizedString(value);

  if (normalized === "database") {
    return "database";
  }

  return "mock_fallback";
}

function normalizeOptionalIdentityText(value: unknown): string | null {
  const normalized = readNormalizedString(value);

  return normalized.length === 0 ? null : normalized;
}

function readProviderMode(
  value: unknown,
  issues: ReaderQaValidationIssue[],
): ReaderQaProviderMode {
  if (value === undefined || value === null) {
    return "mock";
  }

  if (typeof value !== "string") {
    issues.push({
      field: "providerMode",
      message: "Provider mode must be a string.",
    });

    return "mock";
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return "mock";
  }

  if (!isChapterQaProviderMode(normalized)) {
    issues.push({
      field: "providerMode",
      message: "Provider mode is not supported.",
    });

    return "mock";
  }

  return normalized;
}

function createValidationFailure(
  issues: readonly ReaderQaValidationIssue[],
): ReaderQaValidationResult {
  return {
    ok: false,
    issues,
    message: issues.map((issue) => issue.message).join(" "),
  };
}

function readRequiredLimitedText(
  record: Record<string, unknown>,
  key: string,
  field: string,
  maxChars: number,
  issues: ReaderQaValidationIssue[],
): string {
  const value = readNormalizedString(record[key]);

  if (value.length === 0) {
    issues.push({
      field,
      message: `${field} is required.`,
    });
  }

  return truncateText(value, maxChars).text;
}

function readOptionalLimitedText(
  value: unknown,
  maxChars: number,
  fallback: string,
): string {
  const normalized = readNormalizedString(value);

  if (normalized.length === 0) {
    return fallback;
  }

  return truncateText(normalized, maxChars).text;
}

function normalizeNearbyChunks(value: unknown): readonly ChapterQaContextChunk[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const chunks: ChapterQaContextChunk[] = [];
  let totalTextChars = 0;

  for (const [index, item] of value.entries()) {
    if (
      chunks.length >= readerQaValidationLimits.nearbyChunksMaxItems ||
      totalTextChars >= readerQaValidationLimits.nearbyChunksTotalTextMaxChars
    ) {
      break;
    }

    if (!isRecord(item)) {
      continue;
    }

    const remainingTextChars =
      readerQaValidationLimits.nearbyChunksTotalTextMaxChars - totalTextChars;
    const textLimit = Math.min(
      readerQaValidationLimits.nearbyChunkTextMaxChars,
      remainingTextChars,
    );
    const originalText = readNormalizedString(item.text);
    const truncatedText = truncateText(originalText, textLimit);

    if (truncatedText.text.length === 0) {
      continue;
    }

    chunks.push({
      id: normalizeOptionalChunkId(item.id),
      orderIndex: Math.max(readFiniteInteger(item.orderIndex, index), 0),
      text: truncatedText.text,
      truncated: item.truncated === true || truncatedText.truncated,
    });
    totalTextChars += truncatedText.text.length;
  }

  return chunks;
}

function normalizeOptionalChunkId(value: unknown): string | undefined {
  const id = readNormalizedString(value);

  if (id.length === 0) {
    return undefined;
  }

  return truncateText(id, readerQaValidationLimits.chunkIdMaxChars).text;
}

function truncateText(
  value: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  const safeMaxChars = Math.max(0, Math.trunc(maxChars));

  if (value.length <= safeMaxChars) {
    return { text: value, truncated: false };
  }

  if (safeMaxChars <= 3) {
    return {
      text: value.slice(0, safeMaxChars),
      truncated: true,
    };
  }

  return {
    text: `${value.slice(0, safeMaxChars - 3)}...`,
    truncated: true,
  };
}

function readNormalizedString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function readFiniteInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.trunc(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
