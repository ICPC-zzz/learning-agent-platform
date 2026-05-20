import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  BookListItem,
  BookReaderData,
  BookRepository,
  CreateBookChapterInput,
  CreateBookWithContentInput,
  CreateBookWithContentResult,
  CreateContentChunkInput,
  ListBooksInput,
} from "../types.js";

const defaultListBooksLimit = 20;
const maxListBooksLimit = 100;

interface CreatedChapterLookup {
  byInputId: Map<string, string>;
  byOrderIndex: Map<number, string>;
}

export class PrismaBookRepository implements BookRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createBookWithContent(
    input: CreateBookWithContentInput,
  ): Promise<CreateBookWithContentResult> {
    const title = normalizeRequiredText(input.title, "Book title is required.");

    return this.prisma.$transaction(async (transaction) => {
      const bookCreateData: Prisma.BookCreateInput = {
        title,
        author: input.author ?? null,
        sourceType: input.sourceType,
      };

      if (input.sourceMetadata !== undefined) {
        bookCreateData.metadata = input.sourceMetadata;
      }

      const book = await transaction.book.create({
        data: bookCreateData,
      });

      const chapterLookup = await this.createChapters(
        transaction,
        book.id,
        input.chapters,
      );

      const chunkCount = await this.createChunks(
        transaction,
        book.id,
        input.chunks,
        chapterLookup,
      );

      return {
        bookId: book.id,
        chapterCount: input.chapters.length,
        chunkCount,
      };
    });
  }

  async getBookReaderData(bookId: string): Promise<BookReaderData | null> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
    });

    if (book === null) {
      return null;
    }

    const [chapters, chunks] = await Promise.all([
      this.prisma.bookChapter.findMany({
        where: { bookId },
        orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
      }),
      this.prisma.contentChunk.findMany({
        where: { bookId },
        orderBy: [
          { chapter: { orderIndex: "asc" } },
          { orderIndex: "asc" },
          { id: "asc" },
        ],
      }),
    ]);

    return {
      book,
      chapters,
      chunks,
    };
  }

  async listBooks(input: ListBooksInput = {}): Promise<BookListItem[]> {
    const limit = normalizeListBooksLimit(input.limit);

    return this.prisma.book.findMany({
      where:
        input.sourceType === undefined ? {} : { sourceType: input.sourceType },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        sourceType: true,
        title: true,
        subtitle: true,
        author: true,
        description: true,
        sourceUrl: true,
        language: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private async createChapters(
    transaction: Prisma.TransactionClient,
    bookId: string,
    chapters: CreateBookChapterInput[],
  ): Promise<CreatedChapterLookup> {
    const byInputId = new Map<string, string>();
    const byOrderIndex = new Map<number, string>();
    const createdIdByInputIndex = new Map<number, string>();

    for (const [inputIndex, chapter] of chapters.entries()) {
      const title = normalizeRequiredText(
        chapter.title,
        `Chapter at index ${inputIndex} must have a non-empty title.`,
      );

      if (byOrderIndex.has(chapter.orderIndex)) {
        throw new Error(
          `Duplicate chapter orderIndex ${chapter.orderIndex}; chunk chapterOrderIndex mapping would be ambiguous.`,
        );
      }

      const createdChapter = await transaction.bookChapter.create({
        data: {
          book: { connect: { id: bookId } },
          title,
          level: chapter.level,
          orderIndex: chapter.orderIndex,
        },
      });

      byOrderIndex.set(chapter.orderIndex, createdChapter.id);
      createdIdByInputIndex.set(inputIndex, createdChapter.id);

      const inputChapterId = normalizeOptionalText(chapter.id);

      if (inputChapterId !== null) {
        if (byInputId.has(inputChapterId)) {
          throw new Error(`Duplicate input chapter id "${inputChapterId}".`);
        }

        byInputId.set(inputChapterId, createdChapter.id);
      }
    }

    for (const [inputIndex, chapter] of chapters.entries()) {
      const parentInputId = normalizeOptionalText(chapter.parentId);

      if (parentInputId === null) {
        continue;
      }

      const createdChapterId = createdIdByInputIndex.get(inputIndex);
      const parentChapterId = byInputId.get(parentInputId);

      if (createdChapterId === undefined) {
        throw new Error(
          `Created chapter lookup is missing for input index ${inputIndex}.`,
        );
      }

      if (parentChapterId === undefined) {
        throw new Error(
          `Chapter "${chapter.title}" references unknown parentId "${parentInputId}".`,
        );
      }

      if (parentChapterId === createdChapterId) {
        throw new Error(
          `Chapter "${chapter.title}" cannot reference itself as parentId "${parentInputId}".`,
        );
      }

      await transaction.bookChapter.update({
        where: { id: createdChapterId },
        data: {
          parent: { connect: { id: parentChapterId } },
        },
      });
    }

    return { byInputId, byOrderIndex };
  }

  private async createChunks(
    transaction: Prisma.TransactionClient,
    bookId: string,
    chunks: CreateContentChunkInput[],
    chapterLookup: CreatedChapterLookup,
  ): Promise<number> {
    let chunkCount = 0;

    for (const [inputIndex, chunk] of chunks.entries()) {
      const chapterId = resolveChunkChapterId(
        chunk,
        inputIndex,
        chapterLookup,
      );

      const chunkCreateData: Prisma.ContentChunkCreateInput = {
        book: { connect: { id: bookId } },
        chapter: { connect: { id: chapterId } },
        plainText: chunk.plainText,
        orderIndex: chunk.orderIndex,
        startOffset: chunk.startOffset ?? null,
        endOffset: chunk.endOffset ?? null,
      };

      const metadata = createChunkMetadata(chunk);

      if (metadata !== undefined) {
        chunkCreateData.metadata = metadata;
      }

      await transaction.contentChunk.create({
        data: chunkCreateData,
      });

      chunkCount += 1;
    }

    return chunkCount;
  }
}

function resolveChunkChapterId(
  chunk: CreateContentChunkInput,
  inputIndex: number,
  chapterLookup: CreatedChapterLookup,
): string {
  const inputChapterId = normalizeOptionalText(chunk.chapterId);

  if (inputChapterId !== null) {
    const chapterId = chapterLookup.byInputId.get(inputChapterId);

    if (chapterId === undefined) {
      throw new Error(
        `Chunk at index ${inputIndex} references unknown chapterId "${inputChapterId}".`,
      );
    }

    return chapterId;
  }

  if (chunk.chapterOrderIndex !== undefined) {
    const chapterId = chapterLookup.byOrderIndex.get(chunk.chapterOrderIndex);

    if (chapterId === undefined) {
      throw new Error(
        `Chunk at index ${inputIndex} references unknown chapterOrderIndex ${chunk.chapterOrderIndex}.`,
      );
    }

    return chapterId;
  }

  throw new Error(
    `Chunk at index ${inputIndex} must provide chapterId or chapterOrderIndex.`,
  );
}

function createChunkMetadata(
  chunk: CreateContentChunkInput,
): Prisma.InputJsonValue | undefined {
  if (chunk.charCount === undefined) {
    return undefined;
  }

  return {
    charCount: chunk.charCount,
  };
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeListBooksLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultListBooksLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxListBooksLimit);
}
