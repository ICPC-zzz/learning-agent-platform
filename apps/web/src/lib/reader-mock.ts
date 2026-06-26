import { sampleBook } from "./sample-book";
import type { ReaderFallbackReason, ReaderPageData } from "./reader-types";

export function getReaderDataFromMock(
  reason: ReaderFallbackReason = "demo_fallback_requested"
): ReaderPageData {
  const currentChapter = sampleBook.chapters[0];

  if (currentChapter === undefined) {
    throw new Error("Sample reader book must include at least one chapter.");
  }

  const currentChapterChunks = sampleBook.chunks.filter(
    (chunk) => chunk.chapterId === currentChapter.id
  );

  return {
    source: "mock_fallback",
    fallbackReason: reason,
    book: sampleBook.document,
    chapters: sampleBook.chapters,
    chunks: sampleBook.chunks,
    currentChapter,
    currentChapterChunks
  };
}
