import type { ChapteringOptions, ImportedBookChapter } from "../types.js";
import { createChapterId } from "../utils.js";
import { normalizePlainText, trimExcessWhitespace } from "../parsers/text-normalizer.js";
import { detectChapterHeading } from "./heading-detector.js";

export interface BuildChaptersFromPlainTextInput {
  bookId: string;
  text: string;
  options?: ChapteringOptions;
}

interface PendingChapter {
  title: string;
  level: number;
  lines: string[];
}

const DEFAULT_FALLBACK_CHAPTER_TITLE = "Chapter 1";

export function buildChaptersFromPlainText(
  input: BuildChaptersFromPlainTextInput,
): ImportedBookChapter[] {
  const text = normalizePlainText(input.text);

  if (text.length === 0) {
    return [];
  }

  const fallbackChapterTitle = getFallbackChapterTitle(input.options);
  const shouldDetectHeadings = input.options?.detectHeadings ?? true;

  if (!shouldDetectHeadings) {
    return [
      createChapter({
        bookId: input.bookId,
        title: fallbackChapterTitle,
        orderIndex: 0,
        level: 1,
        plainText: text,
      }),
    ];
  }

  const pendingChapters: PendingChapter[] = [];
  let currentChapter: PendingChapter | undefined;
  const prefaceLines: string[] = [];

  for (const line of text.split("\n")) {
    const heading = detectChapterHeading(line);

    if (heading !== undefined) {
      if (currentChapter !== undefined) {
        pendingChapters.push(currentChapter);
      }

      currentChapter = {
        title: heading.title,
        level: heading.level,
        lines: pendingChapters.length === 0 ? prefaceLines.splice(0) : [],
      };
      continue;
    }

    if (currentChapter === undefined) {
      prefaceLines.push(line);
    } else {
      currentChapter.lines.push(line);
    }
  }

  if (currentChapter !== undefined) {
    pendingChapters.push(currentChapter);
  }

  if (pendingChapters.length === 0) {
    return [
      createChapter({
        bookId: input.bookId,
        title: fallbackChapterTitle,
        orderIndex: 0,
        level: 1,
        plainText: text,
      }),
    ];
  }

  return pendingChapters.map((chapter, orderIndex) =>
    createChapter({
      bookId: input.bookId,
      title: chapter.title,
      orderIndex,
      level: chapter.level,
      plainText: trimExcessWhitespace(chapter.lines.join("\n")),
    }),
  );
}

function getFallbackChapterTitle(options: ChapteringOptions | undefined): string {
  const fallbackTitle = options?.fallbackChapterTitle?.trim();
  return fallbackTitle !== undefined && fallbackTitle.length > 0
    ? fallbackTitle
    : DEFAULT_FALLBACK_CHAPTER_TITLE;
}

function createChapter(input: {
  bookId: string;
  title: string;
  orderIndex: number;
  level: number;
  plainText: string;
}): ImportedBookChapter {
  return {
    id: createChapterId(),
    bookId: input.bookId,
    title: input.title,
    orderIndex: input.orderIndex,
    level: input.level,
    plainText: input.plainText,
  };
}
