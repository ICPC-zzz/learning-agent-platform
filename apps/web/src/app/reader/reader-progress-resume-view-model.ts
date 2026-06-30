import type {
  ReaderProgressResumeAdapterResult,
  ReaderProgressResumeRecordPreview,
  ReaderProgressResumeStatus,
} from "./reader-progress-resume-adapter.ts";

export interface ReaderProgressResumeCardView {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  progressRatio: number;
  progressPercent: number;
  updatedAtLabel: string;
  continueReadingHref: string;
  detailHref: string;
  sourceLabel: string;
}

export interface ReaderProgressResumeView {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  productionReady: false;
  writesDatabase: false;
  readsDatabase: boolean;
  callsRepository: boolean;
  callsLLM: false;
  status: ReaderProgressResumeStatus;
  title: string;
  message: string;
  sourceLabel: string;
  ownerLabel: string | null;
  items: ReaderProgressResumeCardView[];
  hasContinueReading: boolean;
  primaryContinueReadingHref: string | null;
  primaryChapterId: string | null;
  primaryBookId: string | null;
  primaryProgressPercent: number | null;
}

const SOURCE_LABEL = "dev-only / read-only";

export function buildReaderProgressResumeView(
  input: ReaderProgressResumeAdapterResult,
): ReaderProgressResumeView {
  const items = input.items.map(mapRecordToCardView);
  const primaryItem = items[0] ?? null;

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase: input.readsDatabase,
    callsRepository: input.callsRepository,
    callsLLM: false,
    status: input.status,
    title: buildTitle(input.status),
    message: buildMessage(input.status, input.message, items.length),
    sourceLabel: SOURCE_LABEL,
    ownerLabel: input.ownerLabel,
    items,
    hasContinueReading: primaryItem !== null,
    primaryContinueReadingHref: primaryItem?.continueReadingHref ?? null,
    primaryChapterId: primaryItem?.chapterId ?? null,
    primaryBookId: primaryItem?.bookId ?? null,
    primaryProgressPercent: primaryItem?.progressPercent ?? null,
  };
}

function mapRecordToCardView(
  record: ReaderProgressResumeRecordPreview,
): ReaderProgressResumeCardView {
  const progressPercent = formatProgressPercent(record.progressRatio);
  const updatedAtLabel = formatDateLabel(record.updatedAt) ?? "unknown";

  return {
    bookId: record.bookId,
    bookTitle: record.bookTitle,
    chapterId: record.chapterId,
    chapterTitle: record.chapterTitle,
    progressRatio: record.progressRatio,
    progressPercent,
    updatedAtLabel,
    continueReadingHref: `/reader?bookId=${encodeURIComponent(record.bookId)}&chapterId=${encodeURIComponent(record.chapterId)}`,
    detailHref: `/books/${encodeURIComponent(record.bookId)}`,
    sourceLabel: SOURCE_LABEL,
  };
}

function formatProgressPercent(progressRatio: number): number {
  if (!Number.isFinite(progressRatio)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(progressRatio * 100), 0), 100);
}

function formatDateLabel(value: string | Date | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildTitle(status: ReaderProgressResumeStatus): string {
  switch (status) {
    case "loaded":
      return "上次阅读进度";
    case "empty":
      return "继续阅读";
    case "read_failed":
      return "继续阅读";
    case "blocked":
      return "继续阅读";
  }
}

function buildMessage(
  status: ReaderProgressResumeStatus,
  message: string,
  itemCount: number,
): string {
  if (status === "loaded") {
    return `${message} 共 ${itemCount} 条 dev-only 阅读进度。`;
  }

  return message;
}

export function readerProgressResumeViewIsSafe(
  view: ReaderProgressResumeView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(view);

  const forbidden = [
    "token",
    "secret",
    "password",
    "DATABASE_URL",
    "cookie",
    "authorization",
    "rawPrompt",
    "rawResponse",
    "agent",
  ];

  for (const pattern of forbidden) {
    if (json.toLowerCase().includes(pattern.toLowerCase())) {
      violations.push(`Forbidden label or secret-like field found: ${pattern}`);
    }
  }

  return { safe: violations.length === 0, violations };
}
