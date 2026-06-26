import type { Prisma } from "@prisma/client";

import type {
  BookSourceType,
  CreateBookChapterInput,
  CreateBookWithContentInput,
  CreateContentChunkInput,
} from "../types.js";

export type ImportedBookRepositorySourceType =
  | "builtin"
  | "imported_text"
  | "imported_markdown"
  | "imported_url"
  | BookSourceType;

export interface ImportedBookRepositoryDocument {
  title: string;
  author?: string | null;
  sourceType: ImportedBookRepositorySourceType;
  sourceMetadata?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface ImportedBookRepositoryChapter {
  id?: string;
  parentId?: string | null;
  title: string;
  orderIndex: number;
  level: number;
  plainText: string;
}

export interface ImportedBookRepositoryChunk {
  id?: string;
  chapterId?: string;
  chapterOrderIndex?: number;
  orderIndex: number;
  plainText: string;
  charCount?: number;
  startOffset?: number | null;
  endOffset?: number | null;
}

export interface ImportedBookRepositoryInput {
  document: ImportedBookRepositoryDocument;
  chapters: readonly ImportedBookRepositoryChapter[];
  chunks: readonly ImportedBookRepositoryChunk[];
}

export function createBookRepositoryInputFromImportedBook(
  input: ImportedBookRepositoryInput,
): CreateBookWithContentInput {
  const sourceMetadata =
    input.document.sourceMetadata ?? input.document.metadata;

  return {
    title: input.document.title,
    author: input.document.author ?? null,
    sourceType: mapImportedBookSourceType(input.document.sourceType),
    ...(sourceMetadata === undefined ? {} : { sourceMetadata }),
    chapters: input.chapters.map(mapImportedChapter),
    chunks: input.chunks.map(mapImportedChunk),
  };
}

export function mapImportedBookSourceType(
  sourceType: ImportedBookRepositorySourceType,
): BookSourceType {
  switch (sourceType) {
    case "builtin":
    case "BUILTIN":
      return "BUILTIN";
    case "imported_text":
    case "IMPORTED_TEXT":
      return "IMPORTED_TEXT";
    case "imported_markdown":
    case "IMPORTED_MARKDOWN":
      return "IMPORTED_MARKDOWN";
    case "imported_url":
    case "IMPORTED_URL":
      return "IMPORTED_URL";
  }
}

function mapImportedChapter(
  chapter: ImportedBookRepositoryChapter,
): CreateBookChapterInput {
  return {
    ...(chapter.id === undefined ? {} : { id: chapter.id }),
    ...(chapter.parentId === undefined ? {} : { parentId: chapter.parentId }),
    title: chapter.title,
    orderIndex: chapter.orderIndex,
    level: chapter.level,
    plainText: chapter.plainText,
  };
}

function mapImportedChunk(
  chunk: ImportedBookRepositoryChunk,
): CreateContentChunkInput {
  return {
    ...(chunk.id === undefined ? {} : { id: chunk.id }),
    ...(chunk.chapterId === undefined ? {} : { chapterId: chunk.chapterId }),
    ...(chunk.chapterOrderIndex === undefined
      ? {}
      : { chapterOrderIndex: chunk.chapterOrderIndex }),
    orderIndex: chunk.orderIndex,
    plainText: chunk.plainText,
    ...(chunk.charCount === undefined ? {} : { charCount: chunk.charCount }),
    ...(chunk.startOffset === undefined
      ? {}
      : { startOffset: chunk.startOffset }),
    ...(chunk.endOffset === undefined ? {} : { endOffset: chunk.endOffset }),
  };
}
