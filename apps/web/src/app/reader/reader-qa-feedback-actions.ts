"use server";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaFeedbackRepository,
  PrismaChapterQaHistoryRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";

import {
  isReaderQaFeedbackRating,
  type ReaderQaFeedbackSaveInput,
  type ReaderQaFeedbackSaveResult,
} from "./reader-qa-feedback-types";

const demoUserEmail = "demo@example.com";
const historyRecordIdMaxChars = 120;
const feedbackNoteMaxChars = 1000;

interface ParsedReaderQaFeedbackInput {
  historyRecordId: string;
  rating: ReaderQaFeedbackSaveInput["rating"];
  note: string | null;
}

export async function saveReaderQaFeedbackAction(
  input: unknown,
): Promise<ReaderQaFeedbackSaveResult> {
  const parsedInput = parseReaderQaFeedbackInput(input);

  if (parsedInput.status !== "ok") {
    return {
      status: parsedInput.status,
      message: parsedInput.message,
    };
  }

  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return {
      status: "database_unavailable",
      message:
        "Q&A feedback was not saved because DATABASE_URL is not configured.",
      historyRecordId: parsedInput.input.historyRecordId,
      rating: parsedInput.input.rating,
    };
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const historyRepository = new PrismaChapterQaHistoryRepository(prisma);
    const feedbackRepository = new PrismaChapterQaFeedbackRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return {
        status: "demo_user_missing",
        message:
          "Q&A feedback was not saved because the demo user was not found.",
        historyRecordId: parsedInput.input.historyRecordId,
        rating: parsedInput.input.rating,
      };
    }

    const historyRecord = await historyRepository.getQuestionAnswerRecordById({
      id: parsedInput.input.historyRecordId,
      userId: demoUser.id,
    });

    if (historyRecord === null) {
      return {
        status: "invalid_history_record",
        message:
          "Q&A feedback was not saved because the history record was not found for the demo user.",
        historyRecordId: parsedInput.input.historyRecordId,
        rating: parsedInput.input.rating,
      };
    }

    const feedback = await feedbackRepository.upsertQuestionAnswerFeedback({
      userId: demoUser.id,
      historyRecordId: parsedInput.input.historyRecordId,
      rating: parsedInput.input.rating,
      note: parsedInput.input.note,
    });

    return {
      status: "saved",
      message: "Q&A feedback saved.",
      historyRecordId: feedback.historyRecordId,
      rating: feedback.rating,
      savedAt: feedback.feedbackAt.toISOString(),
    };
  } catch {
    return {
      status: "save_failed",
      message:
        "Q&A feedback was not saved because the database write failed.",
      historyRecordId: parsedInput.input.historyRecordId,
      rating: parsedInput.input.rating,
    };
  }
}

function parseReaderQaFeedbackInput(
  input: unknown,
):
  | {
      status: "ok";
      input: ParsedReaderQaFeedbackInput;
    }
  | {
      status: "invalid_history_record" | "validation_error";
      message: string;
    } {
  if (!isRecord(input)) {
    return {
      status: "validation_error",
      message: "Q&A feedback input must be an object.",
    };
  }

  const historyRecordId = readNormalizedString(input.historyRecordId);

  if (
    historyRecordId.length === 0 ||
    historyRecordId.length > historyRecordIdMaxChars
  ) {
    return {
      status: "invalid_history_record",
      message: "Q&A feedback requires a valid history record id.",
    };
  }

  if (!isReaderQaFeedbackRating(input.rating)) {
    return {
      status: "validation_error",
      message: "Q&A feedback rating must be helpful, unhelpful, or neutral.",
    };
  }

  const noteResult = normalizeOptionalFeedbackNote(input.note);

  if (!noteResult.ok) {
    return {
      status: "validation_error",
      message: noteResult.message,
    };
  }

  return {
    status: "ok",
    input: {
      historyRecordId,
      rating: input.rating,
      note: noteResult.note,
    },
  };
}

function normalizeOptionalFeedbackNote(
  value: unknown,
):
  | {
      ok: true;
      note: string | null;
    }
  | {
      ok: false;
      message: string;
    } {
  if (value === undefined || value === null) {
    return { ok: true, note: null };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      message: "Q&A feedback note must be text when provided.",
    };
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return { ok: true, note: null };
  }

  if (normalized.length > feedbackNoteMaxChars) {
    return {
      ok: false,
      message: `Q&A feedback note must be ${feedbackNoteMaxChars} characters or fewer.`,
    };
  }

  return { ok: true, note: normalized };
}

function readNormalizedString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
