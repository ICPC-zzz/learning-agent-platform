import type { ReaderChapterView } from "../../lib/reader-types";

export interface ReaderRawSearchParams {
  bookId?: string | string[];
  chapterId?: string | string[];
}

export interface ReaderSearchQuery {
  bookId?: string;
  chapterId?: string;
}

export type ReaderChapterQueryStatus =
  | "default_chapter"
  | "selected_chapter"
  | "invalid_chapter_fallback";

export interface ReaderChapterSelection {
  currentChapter: ReaderChapterView;
  currentChapterIndex: number;
  requestedChapterId?: string;
  status: ReaderChapterQueryStatus;
}

export async function readReaderSearchQuery(
  searchParams?: Promise<ReaderRawSearchParams>,
): Promise<ReaderSearchQuery> {
  if (searchParams === undefined) {
    return {};
  }

  const resolvedSearchParams = await searchParams;

  return {
    bookId: readOptionalQueryText(resolvedSearchParams.bookId),
    chapterId: readOptionalQueryText(resolvedSearchParams.chapterId),
  };
}

export function resolveReaderChapterSelection({
  chapters,
  fallbackChapterId,
  requestedChapterId,
}: {
  chapters: readonly ReaderChapterView[];
  fallbackChapterId: string;
  requestedChapterId?: string;
}): ReaderChapterSelection | null {
  const fallbackChapterIndex = resolveFallbackChapterIndex(
    chapters,
    fallbackChapterId,
  );
  const fallbackChapter = chapters[fallbackChapterIndex];

  if (fallbackChapter === undefined) {
    return null;
  }

  if (requestedChapterId === undefined) {
    return {
      currentChapter: fallbackChapter,
      currentChapterIndex: fallbackChapterIndex,
      status: "default_chapter",
    };
  }

  const requestedChapterIndex = chapters.findIndex(
    (chapter) => chapter.id === requestedChapterId,
  );
  const requestedChapter = chapters[requestedChapterIndex];

  if (requestedChapter === undefined) {
    return {
      currentChapter: fallbackChapter,
      currentChapterIndex: fallbackChapterIndex,
      requestedChapterId,
      status: "invalid_chapter_fallback",
    };
  }

  return {
    currentChapter: requestedChapter,
    currentChapterIndex: requestedChapterIndex,
    requestedChapterId,
    status: "selected_chapter",
  };
}

function resolveFallbackChapterIndex(
  chapters: readonly ReaderChapterView[],
  fallbackChapterId: string,
): number {
  const fallbackChapterIndex = chapters.findIndex(
    (chapter) => chapter.id === fallbackChapterId,
  );

  return fallbackChapterIndex >= 0 ? fallbackChapterIndex : 0;
}

function readOptionalQueryText(
  value: string | string[] | undefined,
): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === undefined) {
    return undefined;
  }

  const normalized = rawValue.trim();

  return normalized.length === 0 ? undefined : normalized;
}
