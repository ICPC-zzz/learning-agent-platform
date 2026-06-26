/**
 * Reader data adapter for the in-memory dev book store.
 * Converts DevBookData into the ReaderPageData shape.
 * ALL data: process-heap only, restart-lossy.
 * @module reader-dev-store
 * @previewOnly - dev/test-only
 */

import { getDevBook } from "../app/import/text-import-save-dev-store";
import type { DevBookData, DevChapterRecord, DevChunkRecord } from "../app/import/text-import-save-dev-store";

interface ReaderChunkView {
  id: string; bookId: string; chapterId: string; orderIndex: number;
  plainText: string; charCount: number;
}

interface ReaderChapterView {
  id: string; bookId: string; title: string; orderIndex: number;
  level: number; plainText: string;
}

export function getReaderDataFromDevStore(bookId: string) {
  const devData = getDevBook(bookId);
  if (devData === null) return null;
  return mapDevDataToReaderPageData(devData);
}

function mapDevDataToReaderPageData(devData: DevBookData) {
  const chunks: ReaderChunkView[] = devData.chunks.map(mapDevChunkToReaderChunk);
  const chapters: ReaderChapterView[] = devData.chapters.map(function (chapter: DevChapterRecord) {
    const chapterChunks = chunks.filter(function (c) { return c.chapterId === chapter.id; });
    return mapDevChapterToReaderChapter(chapter, chapterChunks);
  });
  const currentChapter = chapters[0];
  const currentChapterChunks = currentChapter === undefined
    ? []
    : chunks.filter(function (c) { return c.chapterId === currentChapter.id; });
  if (currentChapter === undefined) throw new Error('Dev store book must include at least one chapter.');
  return {
    source: 'mock_fallback',
    book: { id: devData.book.id, title: devData.book.title, author: devData.book.author ?? undefined, sourceType: devData.book.sourceType },
    chapters: chapters,
    chunks: chunks,
    currentChapter: currentChapter,
    currentChapterChunks: currentChapterChunks,
  };
}

function mapDevChapterToReaderChapter(chapter: DevChapterRecord, chapterChunks: ReaderChunkView[]): ReaderChapterView {
  return {
    id: chapter.id, bookId: chapter.bookId, title: chapter.title,
    orderIndex: chapter.orderIndex, level: chapter.level,
    plainText: chapterChunks.length > 0
      ? chapterChunks.map(function (c) { return c.plainText; }).join('\n\n')
      : chapter.plainText,
  };
}

function mapDevChunkToReaderChunk(chunk: DevChunkRecord): ReaderChunkView {
  return {
    id: chunk.id, bookId: chunk.bookId, chapterId: chunk.chapterId,
    orderIndex: chunk.orderIndex, plainText: chunk.plainText,
    charCount: chunk.plainText.length,
  };
}
