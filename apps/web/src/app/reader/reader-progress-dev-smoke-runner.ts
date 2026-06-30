import {
  getPrismaClient,
  PrismaBookRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type {
  BookSourceType,
  BookListItem,
  BookRepository,
  ReadingProgressRecord,
  ReadingProgressRepository,
  UserRecord,
  UserRepository,
} from "@learning-agent-platform/db";

import {
  buildReaderProgressResumeView,
  readerProgressResumeViewIsSafe,
  type ReaderProgressResumeView,
} from "./reader-progress-resume-view-model.ts";
import {
  loadReaderProgressResumeData,
  type ReaderProgressResumeAdapterResult,
} from "./reader-progress-resume-adapter.ts";
import { loadBookDetail } from "../books/book-detail-loader.ts";
import type { BookDetailLoadResult } from "../books/book-detail-types.ts";
import {
  createRecentReadingProgressViewModel,
  createRecentReadingProgressStatusViewModel,
} from "../learning/recent-reading-progress-mapper.ts";
import type { LearningRecentReadingProgressPanelViewModel } from "../learning/recent-reading-progress-types";

const SMOKE_BOOK_TITLE = "Reader Progress Dev Smoke Book";
const SMOKE_BOOK_AUTHOR = "Learning Agent Platform";
const SMOKE_BOOK_SOURCE_TYPE: BookSourceType = "IMPORTED_TEXT";
const SMOKE_CHAPTER_ID = "lap-reader-progress-dev-smoke-chapter-1";
const SMOKE_CHAPTER_TITLE = "Reader Progress Dev Smoke Chapter";
const SMOKE_CHUNK_ID = "lap-reader-progress-dev-smoke-chunk-1";
const SMOKE_USER_EMAIL = "reader-progress-dev-smoke@example.com";
const SMOKE_USER_NAME = "Reader Progress Dev Smoke";
const SMOKE_USER_PROVIDER = "reader-progress-dev-smoke";
const SMOKE_PROGRESS_RATIO = 0.64;

export type ReaderProgressDevSmokeMode = "dry-run" | "blocked" | "live" | "live_error";

export interface ReaderProgressDevSmokeResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  productionReady: false;
  mode: ReaderProgressDevSmokeMode;
  liveRequested: boolean;
  liveAllowed: boolean;
  writesDatabase: boolean;
  callsRepository: boolean;
  databaseUrlPresent: boolean;
  blockedReasons: string[];
  preparationChecklist: string[];
  message: string;
  bookId: string | null;
  chapterId: string | null;
  progressPercent: number | null;
  resumeAvailable: boolean;
  userIdPreview: string | null;
  userNamePreview: string | null;
  bookCreatedOrReused: "created" | "reused" | null;
  chapterCreatedOrReused: "created" | "reused" | null;
  userCreatedOrReused: "created" | "reused" | null;
  readerResume: {
    status: ReaderProgressResumeAdapterResult["status"];
    safe: boolean;
    hasContinueReading: boolean;
    message: string;
    primaryContinueReadingHref: string | null;
  };
  bookDetail: {
    status: BookDetailLoadResult["status"];
    hasSavedProgress: boolean;
    continueReaderHref: string | null;
    message: string;
  };
  userRecentReading: {
    status: LearningRecentReadingProgressPanelViewModel["status"];
    recentCount: number;
    message: string;
  };
}

export interface ReaderProgressDevSmokeRunInput {
  liveRequested?: boolean;
  env?: NodeJS.ProcessEnv;
  dependencies?: ReaderProgressDevSmokeDependencies | null;
}

export interface ReaderProgressDevSmokeDependencies {
  prisma?: ReturnType<typeof getPrismaClient> | null;
  bookRepository?: ReaderProgressDevSmokeBookRepository | null;
  readingProgressRepository?: ReaderProgressDevSmokeReadingProgressRepository | null;
  userRepository?: ReaderProgressDevSmokeUserRepository | null;
}

export interface ReaderProgressDevSmokeBookRepository
  extends Pick<BookRepository, "createBookWithContent" | "getBookReaderData" | "listBooks"> {}

export interface ReaderProgressDevSmokeReadingProgressRepository
  extends Pick<
    ReadingProgressRepository,
    "listReadingProgress" | "upsertReadingProgress" | "getReadingProgress"
  > {}

export interface ReaderProgressDevSmokeUserRepository
  extends Pick<UserRepository, "findOrCreateUser" | "getUserByEmail"> {}

interface SmokeState {
  mode: ReaderProgressDevSmokeMode;
  liveRequested: boolean;
  liveAllowed: boolean;
  databaseUrlPresent: boolean;
  blockedReasons: string[];
  preparationChecklist: string[];
  bookCreatedOrReused: "created" | "reused" | null;
  chapterCreatedOrReused: "created" | "reused" | null;
  userCreatedOrReused: "created" | "reused" | null;
  bookId: string | null;
  chapterId: string | null;
  progressPercent: number | null;
  userIdPreview: string | null;
  userNamePreview: string | null;
  message: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEnvValue(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function hasDatabaseUrlInEnv(env: NodeJS.ProcessEnv): boolean {
  return isNonEmptyString(env.DATABASE_URL);
}

function isExplicitlyEnabled(value: unknown): boolean {
  const normalized = normalizeEnvValue(value);
  if (normalized === null) {
    return false;
  }

  return normalized === "1" || normalized.toLowerCase() === "true";
}

function isDevOrTestEnvironment(nodeEnv: string | null): boolean {
  if (nodeEnv === null) {
    return false;
  }

  const normalized = nodeEnv.toLowerCase();
  if (normalized === "production") {
    return false;
  }

  return (
    normalized === "development" ||
    normalized === "dev" ||
    normalized === "test" ||
    normalized === "testing" ||
    normalized === "integration" ||
    normalized === "integration-test" ||
    normalized.includes("dev") ||
    normalized.includes("test") ||
    normalized.includes("integration")
  );
}

function evaluateSmokeGuard(env: NodeJS.ProcessEnv): {
  blockedReasons: string[];
  databaseUrlPresent: boolean;
  liveAllowedByEnv: boolean;
  environmentName: string | null;
} {
  const blockedReasons: string[] = [];
  const databaseUrlPresent = hasDatabaseUrlInEnv(env);
  const smokeEnabled = isExplicitlyEnabled(env.LAP_READER_PROGRESS_DEV_SMOKE_ENABLED);
  const allowRealDbIntegration = isExplicitlyEnabled(env.LAP_ALLOW_REAL_DB_INTEGRATION);
  const environmentName = normalizeEnvValue(env.NODE_ENV);
  const environmentAllowed = isDevOrTestEnvironment(environmentName);

  if (!databaseUrlPresent) {
    blockedReasons.push(
      "MISSING_DEV_DATABASE_CONNECTION: a local dev/test database connection string must be configured before a live smoke run.",
    );
  }

  if (!smokeEnabled) {
    blockedReasons.push(
      "LAP_READER_PROGRESS_DEV_SMOKE_ENABLED_REQUIRED: set LAP_READER_PROGRESS_DEV_SMOKE_ENABLED to true or 1.",
    );
  }

  if (!allowRealDbIntegration) {
    blockedReasons.push(
      "LAP_ALLOW_REAL_DB_INTEGRATION_REQUIRED: set LAP_ALLOW_REAL_DB_INTEGRATION to true or 1.",
    );
  }

  if (!environmentAllowed) {
    blockedReasons.push(
      "ENVIRONMENT_NOT_DEV_OR_TEST: NODE_ENV must be development, dev, test, testing, or integration.",
    );
  }

  if (environmentName !== null && environmentName.toLowerCase() === "production") {
    blockedReasons.push("PRODUCTION_BLOCKED: live smoke is never allowed in production.");
  }

  return {
    blockedReasons,
    databaseUrlPresent,
    liveAllowedByEnv:
      databaseUrlPresent &&
      smokeEnabled &&
      allowRealDbIntegration &&
      environmentAllowed &&
      (environmentName?.toLowerCase() ?? "") !== "production",
    environmentName,
  };
}

function createPreparationChecklist(): string[] {
  return [
    "Set a local dev/test PostgreSQL connection string.",
    "Set LAP_READER_PROGRESS_DEV_SMOKE_ENABLED=true or 1.",
    "Set LAP_ALLOW_REAL_DB_INTEGRATION=true or 1.",
    "Use NODE_ENV=development or NODE_ENV=test.",
    "Re-run with `pnpm reader:progress-smoke -- --live` once the guards are in place.",
  ];
}

function createBlockedResult(input: SmokeState): ReaderProgressDevSmokeResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    mode: "blocked",
    liveRequested: input.liveRequested,
    liveAllowed: false,
    writesDatabase: false,
    callsRepository: false,
    databaseUrlPresent: input.databaseUrlPresent,
    blockedReasons: input.blockedReasons,
    preparationChecklist: input.preparationChecklist,
    message: input.message,
    bookId: null,
    chapterId: null,
    progressPercent: null,
    resumeAvailable: false,
    userIdPreview: null,
    userNamePreview: null,
    bookCreatedOrReused: null,
    chapterCreatedOrReused: null,
    userCreatedOrReused: null,
    readerResume: {
      status: "blocked",
      safe: true,
      hasContinueReading: false,
      message: input.message,
      primaryContinueReadingHref: null,
    },
    bookDetail: {
      status: "unavailable",
      hasSavedProgress: false,
      continueReaderHref: null,
      message: input.message,
    },
    userRecentReading: {
      status: "unavailable",
      recentCount: 0,
      message: input.message,
    },
  };
}

function createSafeErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown smoke runner error.";

  return raw
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[REDACTED_DB_URL]")
    .replace(/DATABASE_URL/gi, "[REDACTED]")
    .replace(/api[_-]?key/gi, "[REDACTED_API_KEY]")
    .replace(/secret/gi, "[REDACTED_SECRET]")
    .replace(/token/gi, "[REDACTED_TOKEN]")
    .replace(/password/gi, "[REDACTED_PASSWORD]");
}

function createFailureResult(input: SmokeState, error: unknown): ReaderProgressDevSmokeResult {
  const safeMessage = createSafeErrorMessage(error);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    mode: "live_error",
    liveRequested: input.liveRequested,
    liveAllowed: input.liveAllowed,
    writesDatabase: false,
    callsRepository: true,
    databaseUrlPresent: input.databaseUrlPresent,
    blockedReasons: [`SMOKE_RUN_FAILED: ${safeMessage}`],
    preparationChecklist: input.preparationChecklist,
    message: "Live smoke failed safely and returned sanitized metadata.",
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressPercent: input.progressPercent,
    resumeAvailable: false,
    userIdPreview: input.userIdPreview,
    userNamePreview: input.userNamePreview,
    bookCreatedOrReused: input.bookCreatedOrReused,
    chapterCreatedOrReused: input.chapterCreatedOrReused,
    userCreatedOrReused: input.userCreatedOrReused,
    readerResume: {
      status: "read_failed",
      safe: true,
      hasContinueReading: false,
      message: "Reader resume data could not be loaded safely.",
      primaryContinueReadingHref: null,
    },
    bookDetail: {
      status: "read_failed",
      hasSavedProgress: false,
      continueReaderHref: null,
      message: "Book detail could not be loaded safely.",
    },
    userRecentReading: {
      status: "read_failed",
      recentCount: 0,
      message: "User recent reading could not be loaded safely.",
    },
  };
}

function isBookListItemMatch(item: BookListItem): boolean {
  return (
    item.title === SMOKE_BOOK_TITLE &&
    item.author === SMOKE_BOOK_AUTHOR &&
    item.sourceType === SMOKE_BOOK_SOURCE_TYPE
  );
}

function createSmokeBookInput(): Parameters<BookRepository["createBookWithContent"]>[0] {
  return {
    title: SMOKE_BOOK_TITLE,
    author: SMOKE_BOOK_AUTHOR,
    sourceType: SMOKE_BOOK_SOURCE_TYPE,
    sourceMetadata: {
      smokeRunner: "reader-progress-dev-smoke",
      smokeVersion: 1,
      safeToExposeToClient: true,
    },
    chapters: [
      {
        id: SMOKE_CHAPTER_ID,
        title: SMOKE_CHAPTER_TITLE,
        orderIndex: 0,
        level: 1,
        plainText: "Reader progress smoke test chapter content.",
      },
    ],
    chunks: [
      {
        id: SMOKE_CHUNK_ID,
        chapterId: SMOKE_CHAPTER_ID,
        orderIndex: 0,
        plainText: "Reader progress smoke test chunk content.",
        charCount: "Reader progress smoke test chunk content.".length,
      },
    ],
  };
}

async function loadOrCreateSmokeBook(
  bookRepository: ReaderProgressDevSmokeBookRepository,
): Promise<{ bookId: string; chapterId: string; createdOrReused: "created" | "reused" }> {
  const books = await bookRepository.listBooks({
    limit: 100,
    sourceType: SMOKE_BOOK_SOURCE_TYPE,
  });
  const existingBook = books.find(isBookListItemMatch);

  if (existingBook !== undefined) {
    const readerData = await bookRepository.getBookReaderData(existingBook.id);
    const chapterId = readerData?.chapters[0]?.id ?? SMOKE_CHAPTER_ID;
    return {
      bookId: existingBook.id,
      chapterId,
      createdOrReused: "reused",
    };
  }

  const created = await bookRepository.createBookWithContent(createSmokeBookInput());
  const chapterId = created.chapterIds?.[0] ?? SMOKE_CHAPTER_ID;

  return {
    bookId: created.bookId,
    chapterId,
    createdOrReused: "created",
  };
}

function buildRecentReadingView(
  records: readonly ReadingProgressRecord[],
): LearningRecentReadingProgressPanelViewModel {
  if (records.length === 0) {
    return createRecentReadingProgressStatusViewModel({
      status: "empty",
      source: "empty",
      message: "Smoke user has no saved reading progress records.",
      limit: 3,
    });
  }

  return createRecentReadingProgressViewModel({
    records,
    limit: 3,
  });
}

function buildResumeAvailable(
  readerResumeView: ReaderProgressResumeView,
  bookDetailResult: BookDetailLoadResult,
  userRecentReadingView: LearningRecentReadingProgressPanelViewModel,
): boolean {
  return (
    readerResumeView.hasContinueReading &&
    bookDetailResult.status === "loaded" &&
    bookDetailResult.book.readingProgress.hasSavedProgress &&
    userRecentReadingView.status === "loaded"
  );
}

async function loadOrCreateSmokeUser(
  userRepository: ReaderProgressDevSmokeUserRepository,
): Promise<{ user: UserRecord; createdOrReused: "created" | "reused" }> {
  const existingUser = await userRepository.getUserByEmail(SMOKE_USER_EMAIL);

  if (existingUser !== null) {
    return {
      user: existingUser,
      createdOrReused: "reused",
    };
  }

  const createdUser = await userRepository.findOrCreateUser({
    email: SMOKE_USER_EMAIL,
    name: SMOKE_USER_NAME,
    authProvider: SMOKE_USER_PROVIDER,
    authProviderId: SMOKE_USER_PROVIDER,
  });

  return {
    user: createdUser,
    createdOrReused: "created",
  };
}

export async function runReaderProgressDevSmoke(
  input: ReaderProgressDevSmokeRunInput = {},
): Promise<ReaderProgressDevSmokeResult> {
  const env = input.env ?? process.env;
  const liveRequested = input.liveRequested === true;
  const guard = evaluateSmokeGuard(env);
  const preparationChecklist = createPreparationChecklist();

  const baseState: SmokeState = {
    mode: liveRequested ? "blocked" : "dry-run",
    liveRequested,
    liveAllowed: guard.liveAllowedByEnv,
    databaseUrlPresent: guard.databaseUrlPresent,
    blockedReasons: guard.blockedReasons,
    preparationChecklist,
    bookCreatedOrReused: null,
    chapterCreatedOrReused: null,
    userCreatedOrReused: null,
    bookId: null,
    chapterId: null,
    progressPercent: Math.round(SMOKE_PROGRESS_RATIO * 100),
    userIdPreview: null,
    userNamePreview: null,
    message: liveRequested
      ? "Live smoke is blocked until every explicit guard passes."
      : "Dry-run only. No database writes were attempted.",
  };

  if (!liveRequested) {
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      productionReady: false,
      mode: "dry-run",
      liveRequested: false,
      liveAllowed: false,
      writesDatabase: false,
      callsRepository: false,
      databaseUrlPresent: guard.databaseUrlPresent,
      blockedReasons: guard.blockedReasons,
      preparationChecklist,
      message: guard.databaseUrlPresent
        ? "Dry-run completed safely. Use --live only after the smoke guards are enabled."
        : "Dry-run completed safely. The local dev/test database connection is missing, so live smoke remains blocked.",
      bookId: null,
      chapterId: null,
      progressPercent: Math.round(SMOKE_PROGRESS_RATIO * 100),
      resumeAvailable: false,
      userIdPreview: null,
      userNamePreview: null,
      bookCreatedOrReused: null,
      chapterCreatedOrReused: null,
      userCreatedOrReused: null,
      readerResume: {
        status: "blocked",
        safe: true,
        hasContinueReading: false,
        message: "Dry-run mode does not touch the database.",
        primaryContinueReadingHref: null,
      },
      bookDetail: {
        status: "unavailable",
        hasSavedProgress: false,
        continueReaderHref: null,
        message: "Dry-run mode does not touch the database.",
      },
      userRecentReading: {
        status: "unavailable",
        recentCount: 0,
        message: "Dry-run mode does not touch the database.",
      },
    };
  }

  if (!guard.liveAllowedByEnv) {
    return createBlockedResult({
      ...baseState,
      mode: "blocked",
      message: "Live smoke is blocked until every explicit guard passes.",
      bookId: null,
      chapterId: null,
      userIdPreview: null,
      userNamePreview: null,
    });
  }

  const needsPrisma =
    input.dependencies?.bookRepository === undefined ||
    input.dependencies?.readingProgressRepository === undefined ||
    input.dependencies?.userRepository === undefined;
  const prisma =
    input.dependencies?.prisma ?? (needsPrisma ? getPrismaClient() : null);
  const bookRepository =
    input.dependencies?.bookRepository ?? new PrismaBookRepository(prisma as NonNullable<typeof prisma>);
  const readingProgressRepository =
    input.dependencies?.readingProgressRepository ??
    new PrismaReadingProgressRepository(prisma as NonNullable<typeof prisma>);
  const userRepository =
    input.dependencies?.userRepository ?? new PrismaUserRepository(prisma as NonNullable<typeof prisma>);

  try {
    const smokeUser = await loadOrCreateSmokeUser(userRepository);

    const smokeBook = await loadOrCreateSmokeBook(bookRepository);
    const savedRecord = await readingProgressRepository.upsertReadingProgress({
      userId: smokeUser.user.id,
      bookId: smokeBook.bookId,
      chapterId: smokeBook.chapterId,
      progressRatio: SMOKE_PROGRESS_RATIO,
    });
    const readerResume = buildReaderProgressResumeView(
      await loadReaderProgressResumeData({
        ownerId: smokeUser.user.id,
        ownerLabel: smokeUser.user.name ?? SMOKE_USER_NAME,
        bookId: smokeBook.bookId,
        limit: 3,
        readingProgressRepository,
        bookRepository,
      }),
    );
    const bookDetail = await loadBookDetail({
      bookId: smokeBook.bookId,
      ownerId: smokeUser.user.id,
    });
    const recentReadingRecords = await readingProgressRepository.listReadingProgress({
      userId: smokeUser.user.id,
      bookId: smokeBook.bookId,
      limit: 3,
    });
    const userRecentReading = buildRecentReadingView(recentReadingRecords);

    const resumeAvailable = buildResumeAvailable(readerResume, bookDetail, userRecentReading);
    const safeSummary = readerProgressResumeViewIsSafe(readerResume);

    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      productionReady: false,
      mode: "live",
      liveRequested: true,
      liveAllowed: true,
      writesDatabase: true,
      callsRepository: true,
      databaseUrlPresent: true,
      blockedReasons: safeSummary.safe ? [] : safeSummary.violations,
      preparationChecklist,
      message: resumeAvailable
        ? "Live smoke completed successfully."
        : "Live smoke completed, but the resume chain was not fully available.",
      bookId: savedRecord.bookId,
      chapterId: savedRecord.chapterId,
      progressPercent: Math.round(savedRecord.progressRatio * 100),
      resumeAvailable,
      userIdPreview: smokeUser.user.id,
      userNamePreview: smokeUser.user.name ?? SMOKE_USER_NAME,
      bookCreatedOrReused: smokeBook.createdOrReused,
      chapterCreatedOrReused: smokeBook.createdOrReused,
      userCreatedOrReused: smokeUser.createdOrReused,
      readerResume: {
        status: readerResume.status,
        safe: safeSummary.safe,
        hasContinueReading: readerResume.hasContinueReading,
        message: readerResume.message,
        primaryContinueReadingHref: readerResume.primaryContinueReadingHref,
      },
      bookDetail: {
        status: bookDetail.status,
        hasSavedProgress:
          bookDetail.status === "loaded" ? bookDetail.book.readingProgress.hasSavedProgress : false,
        continueReaderHref:
          bookDetail.status === "loaded" ? bookDetail.book.readingProgress.continueReaderHref : null,
        message: bookDetail.message,
      },
      userRecentReading: {
        status: userRecentReading.status,
        recentCount: userRecentReading.recentCount,
        message: userRecentReading.message,
      },
    };
  } catch (error: unknown) {
    return createFailureResult(baseState, error);
  }
}

export function formatReaderProgressDevSmokeResult(
  result: ReaderProgressDevSmokeResult,
): string {
  const lines: string[] = [];
  lines.push("=== Reader Progress Dev Smoke ===");
  lines.push(`mode: ${result.mode}`);
  lines.push(`liveRequested: ${result.liveRequested ? "yes" : "no"}`);
  lines.push(`liveAllowed: ${result.liveAllowed ? "yes" : "no"}`);
  lines.push(`writesDatabase: ${result.writesDatabase ? "yes" : "no"}`);
  lines.push(`callsRepository: ${result.callsRepository ? "yes" : "no"}`);
  lines.push(`databaseUrlPresent: ${result.databaseUrlPresent ? "yes" : "no"}`);
  lines.push(`bookId: ${result.bookId ?? "n/a"}`);
  lines.push(`chapterId: ${result.chapterId ?? "n/a"}`);
  lines.push(`progressPercent: ${result.progressPercent ?? "n/a"}`);
  lines.push(`resumeAvailable: ${result.resumeAvailable ? "yes" : "no"}`);
  lines.push(`readerStatus: ${result.readerResume.status}`);
  lines.push(`bookDetailStatus: ${result.bookDetail.status}`);
  lines.push(`userRecentReadingStatus: ${result.userRecentReading.status}`);
  lines.push(`message: ${result.message}`);

  if (result.blockedReasons.length > 0) {
    lines.push("blockedReasons:");
    for (const reason of result.blockedReasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (result.mode !== "live") {
    lines.push("preparationChecklist:");
    for (const item of result.preparationChecklist) {
      lines.push(`- ${item}`);
    }
  }

  if (result.mode === "live") {
    lines.push("liveSummary:");
    lines.push(`- userIdPreview: ${result.userIdPreview ?? "n/a"}`);
    lines.push(`- userNamePreview: ${result.userNamePreview ?? "n/a"}`);
    lines.push(`- bookCreatedOrReused: ${result.bookCreatedOrReused ?? "n/a"}`);
    lines.push(`- chapterCreatedOrReused: ${result.chapterCreatedOrReused ?? "n/a"}`);
    lines.push(`- userCreatedOrReused: ${result.userCreatedOrReused ?? "n/a"}`);
    lines.push(`- readerResumePrimaryHref: ${result.readerResume.primaryContinueReadingHref ?? "n/a"}`);
    lines.push(`- bookDetailContinueHref: ${result.bookDetail.continueReaderHref ?? "n/a"}`);
    lines.push(`- recentReadingCount: ${result.userRecentReading.recentCount}`);
  }

  return lines.join("\n");
}
