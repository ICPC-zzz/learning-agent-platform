import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository
} from "@learning-agent-platform/db";
import type { BookReaderData } from "@learning-agent-platform/db";

import type {
  ReaderChapterView,
  ReaderChunkView,
  ReaderFallbackReason,
  ReaderPageData
} from "./reader-types";

interface ReaderDatabaseReadResult {
  data: ReaderPageData | null;
  fallbackReason?: ReaderFallbackReason;
}

interface ReaderDatabaseReadInput {
  bookId?: string;
}

export async function getReaderDataFromDatabase(
  input: ReaderDatabaseReadInput = {}
): Promise<ReaderPageData | null> {
  const result = await getReaderDataFromDatabaseResult(input);

  return result.data;
}

export async function getReaderDataFromDatabaseResult(
  input: ReaderDatabaseReadInput = {}
): Promise<ReaderDatabaseReadResult> {
  if (!hasDatabaseUrl()) {
    return {
      data: null,
      fallbackReason: "missing_database_url"
    };
  }

  try {
    const bookRepository = new PrismaBookRepository(getPrismaClient());
    const requestedBookId = normalizeOptionalText(input.bookId);

    if (requestedBookId !== null) {
      const readerData = await bookRepository.getBookReaderData(requestedBookId);

      if (readerData === null || readerData.chapters.length === 0) {
        return {
          data: null,
          fallbackReason: "no_database_book_found"
        };
      }

      return {
        data: mapDatabaseReaderData(readerData)
      };
    }

    const books = await bookRepository.listBooks({ limit: 1 });
    const firstBook = books[0];

    if (firstBook === undefined) {
      return {
        data: null,
        fallbackReason: "no_database_book_found"
      };
    }

    const readerData = await bookRepository.getBookReaderData(firstBook.id);

    if (readerData === null || readerData.chapters.length === 0) {
      return {
        data: null,
        fallbackReason: "no_database_book_found"
      };
    }

    return {
      data: mapDatabaseReaderData(readerData)
    };
  } catch {
    return {
      data: null,
      fallbackReason: "database_read_failed"
    };
  }
}

function mapDatabaseReaderData(readerData: BookReaderData): ReaderPageData {
  const chunks = readerData.chunks.map(mapDatabaseChunk);
  const chapters = readerData.chapters.map((chapter) =>
    mapDatabaseChapter(
      chapter,
      chunks.filter((chunk) => chunk.chapterId === chapter.id)
    )
  );
  const currentChapter = chapters[0];
  const currentChapterChunks =
    currentChapter === undefined
      ? []
      : chunks.filter((chunk) => chunk.chapterId === currentChapter.id);

  if (currentChapter === undefined) {
    throw new Error("Readable database book must include at least one chapter.");
  }

  return {
    source: "database",
    book: {
      id: readerData.book.id,
      title: readerData.book.title,
      author: readerData.book.author,
      sourceType: readerData.book.sourceType
    },
    chapters,
    chunks,
    currentChapter,
    currentChapterChunks
  };
}

function mapDatabaseChapter(
  chapter: BookReaderData["chapters"][number],
  chapterChunks: ReaderChunkView[]
): ReaderChapterView {
  return {
    id: chapter.id,
    bookId: chapter.bookId,
    parentId: chapter.parentId,
    title: chapter.title,
    orderIndex: chapter.orderIndex,
    level: chapter.level,
    plainText: createChapterPlainText(chapter.summary, chapterChunks)
  };
}

function mapDatabaseChunk(chunk: BookReaderData["chunks"][number]): ReaderChunkView {
  return {
    id: chunk.id,
    bookId: chunk.bookId,
    chapterId: chunk.chapterId,
    orderIndex: chunk.orderIndex,
    plainText: chunk.plainText,
    charCount: getChunkCharCount(chunk.plainText, chunk.metadata),
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset
  };
}

function createChapterPlainText(
  chapterSummary: string | null,
  chunks: ReaderChunkView[]
): string {
  if (chunks.length > 0) {
    return chunks.map((chunk) => chunk.plainText).join("\n\n");
  }

  return chapterSummary ?? "";
}

function getChunkCharCount(plainText: string, metadata: unknown): number {
  const metadataCharCount = readMetadataCharCount(metadata);

  return metadataCharCount ?? plainText.length;
}

function readMetadataCharCount(metadata: unknown): number | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const charCount = (metadata as Record<string, unknown>)["charCount"];

  if (typeof charCount !== "number" || !Number.isFinite(charCount)) {
    return null;
  }

  return Math.max(0, Math.trunc(charCount));
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}
