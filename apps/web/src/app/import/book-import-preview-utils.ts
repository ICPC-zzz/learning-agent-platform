import type {
  ImportedContentChunk,
  TextImportResult,
} from "@learning-agent-platform/book-engine";

import type {
  ImportLanguage,
  ImportPreviewChapterViewModel,
  ImportPreviewViewModel,
} from "./book-import-preview-types";
import {
  BOOK_IMPORT_DEFAULT_MAX_CHUNK_CHARS,
  BOOK_IMPORT_DEFAULT_OVERLAP_CHARS,
} from "./book-import-save-types";

export const DEFAULT_PREVIEW_MAX_CHUNK_CHARS =
  BOOK_IMPORT_DEFAULT_MAX_CHUNK_CHARS;
export const DEFAULT_PREVIEW_OVERLAP_CHARS =
  BOOK_IMPORT_DEFAULT_OVERLAP_CHARS;

const DEFAULT_CHAPTER_PREVIEW_LIMIT = 5;
const DEFAULT_CHUNK_PREVIEW_LIMIT_PER_CHAPTER = 2;
const CHAPTER_TEXT_PREVIEW_CHARS = 180;
const CHUNK_TEXT_PREVIEW_CHARS = 220;

export interface BuildImportPreviewViewModelInput {
  result: TextImportResult;
  language: ImportLanguage;
  totalChars: number;
  maxChunkChars: number;
  overlapChars: number;
  chapterPreviewLimit?: number;
  chunkPreviewLimitPerChapter?: number;
}

export function buildImportPreviewViewModel({
  result,
  language,
  totalChars,
  maxChunkChars,
  overlapChars,
  chapterPreviewLimit = DEFAULT_CHAPTER_PREVIEW_LIMIT,
  chunkPreviewLimitPerChapter = DEFAULT_CHUNK_PREVIEW_LIMIT_PER_CHAPTER,
}: BuildImportPreviewViewModelInput): ImportPreviewViewModel {
  const chunksByChapterId = groupChunksByChapterId(result.chunks);
  const chapters = result.chapters
    .slice(0, chapterPreviewLimit)
    .map<ImportPreviewChapterViewModel>((chapter) => {
      const chapterChunks = chunksByChapterId.get(chapter.id) ?? [];

      return {
        id: chapter.id,
        orderIndex: chapter.orderIndex,
        title: chapter.title,
        level: chapter.level,
        charCount: chapter.plainText.length,
        chunkCount: chapterChunks.length,
        previewText: truncatePreviewText(chapter.plainText, CHAPTER_TEXT_PREVIEW_CHARS),
        previewChunks: chapterChunks
          .slice(0, chunkPreviewLimitPerChapter)
          .map((chunk) => ({
            id: chunk.id,
            orderIndex: chunk.orderIndex,
            charCount: chunk.charCount,
            previewText: truncatePreviewText(chunk.plainText, CHUNK_TEXT_PREVIEW_CHARS),
          })),
      };
    });

  return {
    title: result.document.title,
    author: result.document.author,
    language,
    source: "local_preview",
    persistenceStatus: "not_saved",
    totalChapters: result.chapters.length,
    totalChunks: result.chunks.length,
    totalChars,
    chapterPreviewLimit,
    chunkPreviewLimitPerChapter,
    omittedChapterCount: Math.max(0, result.chapters.length - chapters.length),
    chunkSettings: {
      maxChunkChars,
      overlapChars,
    },
    warnings: result.warnings.map((warning) => `${warning.code}: ${warning.message}`),
    chapters,
  };
}

export function truncatePreviewText(text: string, maxLength: number): string {
  const compactText = text.replace(/\s+/g, " ").trim();

  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function groupChunksByChapterId(
  chunks: ImportedContentChunk[],
): Map<string, ImportedContentChunk[]> {
  const chunksByChapterId = new Map<string, ImportedContentChunk[]>();

  for (const chunk of chunks) {
    const chapterChunks = chunksByChapterId.get(chunk.chapterId) ?? [];
    chapterChunks.push(chunk);
    chunksByChapterId.set(chunk.chapterId, chapterChunks);
  }

  return chunksByChapterId;
}
